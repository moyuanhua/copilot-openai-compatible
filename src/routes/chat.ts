/**
 * POST /v1/chat/completions
 *
 * Accepts an OpenAI-compatible chat completion request and proxies it through
 * the GitHub Copilot SDK.  Supports both streaming (SSE) and non-streaming modes.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import type { Config } from "../config.js";
import { generate } from "../copilot/client.js";
import { extractPassthroughToken } from "../middleware/auth.js";
import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from "../types/openai.js";

// ── Validation schema ─────────────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(MessageSchema).min(1),
  temperature: z.number().optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  n: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  user: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sendStreamChunk(res: Response, chunk: ChatCompletionChunk): void {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

function sendStreamDone(res: Response): void {
  res.write("data: [DONE]\n\n");
}

function sendStreamError(res: Response, message: string): void {
  res.write(
    `data: ${JSON.stringify({ error: { message, type: "server_error", code: null, param: null } })}\n\n`,
  );
}

// ── Route factory ─────────────────────────────────────────────────────────────

export function createChatRouter(config: Config): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response): Promise<void> => {
    // Validate request body
    const parsed = ChatCompletionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          message: `Invalid request: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
          type: "invalid_request_error",
          code: "invalid_request",
          param: null,
        },
      });
      return;
    }

    const { model, messages, stream } = parsed.data;
    const completionId = makeId();
    const created = Math.floor(Date.now() / 1000);
    const passthroughToken = extractPassthroughToken(req, config);

    if (stream) {
      // ── Streaming response ─────────────────────────────────────────────────
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Send first chunk with role
      const firstChunk: ChatCompletionChunk = {
        id: completionId,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
      };
      sendStreamChunk(res, firstChunk);

      let hasError = false;

      try {
        await generate(
          config,
          {
            messages: messages as ChatMessage[],
            model,
            stream: true,
            onDelta: (token) => {
              const chunk: ChatCompletionChunk = {
                id: completionId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
              };
              sendStreamChunk(res, chunk);
            },
            onError: (err) => {
              hasError = true;
              sendStreamError(res, `Copilot error (${err.errorType}): ${err.message}`);
            },
          },
          passthroughToken,
        );
      } catch (err) {
        hasError = true;
        const msg = err instanceof Error ? err.message : String(err);
        sendStreamError(res, msg);
      }

      if (!hasError) {
        // Send stop chunk
        const stopChunk: ChatCompletionChunk = {
          id: completionId,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        };
        sendStreamChunk(res, stopChunk);
      }

      sendStreamDone(res);
      res.end();
    } else {
      // ── Non-streaming response ─────────────────────────────────────────────
      try {
        const result = await generate(
          config,
          {
            messages: messages as ChatMessage[],
            model,
            stream: false,
          },
          passthroughToken,
        );

        const response: ChatCompletionResponse = {
          id: completionId,
          object: "chat.completion",
          created,
          model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: result.content },
              finish_reason: "stop",
            },
          ],
          usage: {
            // Token counts are not available from the Copilot SDK; use estimates
            prompt_tokens: -1,
            completion_tokens: -1,
            total_tokens: -1,
          },
        };

        res.json(response);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(502).json({
          error: {
            message: `Copilot SDK error: ${msg}`,
            type: "server_error",
            code: "copilot_error",
            param: null,
          },
        });
      }
    }
  });

  return router;
}
