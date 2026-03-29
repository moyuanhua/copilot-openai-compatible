import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import type { SessionManager } from "../session-manager.js";
import type { ChatCompletionRequest } from "../types.js";
import { DEFAULT_MODEL, resolveModel } from "../types.js";
import { convertMessages, buildSystemContent } from "../utils/messages.js";
import { convertTools } from "../utils/tools.js";
import {
  makeCompletionResponse,
  makeStreamChunk,
  makeStreamRoleChunk,
  makeStreamStopChunk,
  STREAM_DONE,
} from "../utils/response.js";

export function createChatRouter(sessionManager: SessionManager): Router {
  const router = Router();

  /**
   * POST /v1/chat/completions
   *
   * Translates an OpenAI chat completion request to a GitHub Copilot SDK session
   * and streams or collects the response.
   *
   * Multi-turn behaviour:
   *  - If the request carries an `X-Session-Id` header AND a session with that
   *    id already exists, only the last user message is sent (the session holds
   *    the prior context).
   *  - Otherwise, a new session is created and the full conversation history is
   *    injected as a system-level context block before sending the last prompt.
   *
   * Ephemeral sessions (no X-Session-Id header) are disconnected after the
   * response is complete.
   */
  router.post("/", async (req: Request, res: Response) => {
    let body: ChatCompletionRequest;
    try {
      body = req.body as ChatCompletionRequest;
      if (!body || !Array.isArray(body.messages)) {
        res.status(400).json({ error: { message: "messages array is required", type: "invalid_request_error" } });
        return;
      }
    } catch {
      res.status(400).json({ error: { message: "Invalid JSON body", type: "invalid_request_error" } });
      return;
    }

    const requestedModel = body.model || DEFAULT_MODEL;
    const model = resolveModel(requestedModel);
    if (!model) {
      res.status(400).json({
        error: {
          message: `Unknown model: "${requestedModel}". Call GET /v1/models for the list of supported models.`,
          type: "invalid_request_error",
          param: "model",
          code: "model_not_found",
        },
      });
      return;
    }
    if (model !== requestedModel) {
      console.log(`[chat] Model alias resolved: "${requestedModel}" → "${model}"`);
    }
    const requestedStream = body.stream === true;
    const headerSessionId = req.headers["x-session-id"] as string | undefined;
    const isEphemeral = !headerSessionId;

    // Convert OpenAI messages → Copilot session inputs
    const { systemContent, historyBlock, lastUserPrompt } = convertMessages(body.messages);

    if (!lastUserPrompt.trim()) {
      res.status(400).json({ error: { message: "No user message found in messages array", type: "invalid_request_error" } });
      return;
    }

    // Convert OpenAI tools → Copilot SDK tools
    const sdkTools = body.tools && body.tools.length > 0 ? convertTools(body.tools) : undefined;

    // ── Determine the system content for session creation ──────────────────────
    // For a resumed session the system message was already set at creation time.
    // For a new session we combine the system prompt with the conversation history.
    const fullSystemContent = buildSystemContent(systemContent, historyBlock);

    let sessionEntry: { session: Awaited<ReturnType<typeof sessionManager["getOrCreate"]>>["session"]; isNew: boolean };
    try {
      sessionEntry = await sessionManager.getOrCreate(
        isEphemeral ? undefined : headerSessionId,
        {
          model,
          systemContent: fullSystemContent,
          tools: sdkTools,
          streaming: true, // always enable streaming at the SDK layer
        },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[chat] Failed to get/create session:", message);
      res.status(502).json({ error: { message: `Copilot session error: ${message}`, type: "api_error" } });
      return;
    }

    const { session, isNew } = sessionEntry;

    // For a resumed (non-new) session, inject history as context if we have it
    // by prepending it to the prompt.  This keeps the session's actual message
    // history intact while ensuring the model sees any relevant prior context.
    const promptToSend = buildPrompt(lastUserPrompt, isNew ? undefined : historyBlock);

    // ── Streaming response ────────────────────────────────────────────────────
    if (requestedStream) {
      await handleStreamingResponse(res, session, model, promptToSend, sessionManager, isEphemeral, headerSessionId);
    } else {
      // ── Non-streaming response ──────────────────────────────────────────────
      await handleNonStreamingResponse(res, session, model, promptToSend, sessionManager, isEphemeral, headerSessionId);
    }
  });

  return router;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * For resumed sessions, prepend history context to the prompt so the model can
 * reference it without needing a system-message update.
 */
function buildPrompt(userPrompt: string, historyBlock: string | undefined): string {
  if (!historyBlock) return userPrompt;
  return `${historyBlock}\n\n${userPrompt}`;
}

async function handleStreamingResponse(
  res: Response,
  session: Awaited<ReturnType<typeof SessionManager.prototype.getOrCreate>>["session"],
  model: string,
  prompt: string,
  sessionManager: SessionManager,
  isEphemeral: boolean,
  sessionId: string | undefined,
): Promise<void> {
  const streamId = `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send role-establish chunk first (mirrors OpenAI)
  res.write(makeStreamRoleChunk(streamId, model));

  return new Promise<void>((resolve) => {
    const unsubscribers: Array<() => void> = [];

    const cleanup = () => {
      unsubscribers.forEach((u) => u());
    };

    const done = () => {
      cleanup();
      res.write(makeStreamStopChunk(streamId, model));
      res.write(STREAM_DONE);
      res.end();

      if (isEphemeral) {
        session.disconnect().catch((err: unknown) => console.warn("[chat] Ephemeral disconnect error:", err));
      } else if (sessionId) {
        // Touch the session so TTL resets
        sessionManager.getOrCreate(sessionId, { model }).catch(() => {/* already exists */});
      }

      resolve();
    };

    // Listen to streaming delta events
    const unsubDelta = session.on("assistant.message_delta", (event: { data: { deltaContent: string } }) => {
      const delta = event?.data?.deltaContent ?? "";
      if (delta) {
        res.write(makeStreamChunk(streamId, model, delta));
      }
    });

    // Session idle = generation complete
    const unsubIdle = session.on("session.idle", () => {
      done();
    });

    unsubscribers.push(unsubDelta, unsubIdle);

    // Handle client disconnect
    res.on("close", () => {
      cleanup();
      resolve();
    });

    // Send the prompt
    session.send({ prompt }).catch((err: unknown) => {
      console.error("[chat] session.send error:", err);
      cleanup();
      res.write(`data: ${JSON.stringify({ error: { message: String(err) } })}\n\n`);
      res.write(STREAM_DONE);
      res.end();
      if (isEphemeral) session.disconnect().catch(() => {/* ignore */});
      resolve();
    });
  });
}

async function handleNonStreamingResponse(
  res: Response,
  session: Awaited<ReturnType<typeof SessionManager.prototype.getOrCreate>>["session"],
  model: string,
  prompt: string,
  sessionManager: SessionManager,
  isEphemeral: boolean,
  sessionId: string | undefined,
): Promise<void> {
  // Collect streaming deltas rather than using sendAndWait, which relies on
  // session.idle and can time out if the SDK never emits the event.
  return new Promise<void>((resolve) => {
    const chunks: string[] = [];
    const unsubscribers: Array<() => void> = [];

    const finish = (err?: string) => {
      unsubscribers.forEach(u => u());

      if (err) {
        res.status(502).json({ error: { message: `Copilot error: ${err}`, type: "api_error" } });
      } else {
        res.json(makeCompletionResponse(model, chunks.join("")));
      }

      if (isEphemeral) {
        session.disconnect().catch((e: unknown) => console.warn("[chat] Ephemeral disconnect error:", e));
      } else if (sessionId) {
        sessionManager.getOrCreate(sessionId, { model }).catch(() => {/* already exists */});
      }
      resolve();
    };

    const unsubDelta = session.on("assistant.message_delta", (event: { data: { deltaContent: string } }) => {
      const delta = event?.data?.deltaContent ?? "";
      if (delta) chunks.push(delta);
    });

    const unsubIdle = session.on("session.idle", () => finish());

    unsubscribers.push(unsubDelta, unsubIdle);

    session.send({ prompt }).catch((err: unknown) => {
      finish(String(err));
    });
  });
}
