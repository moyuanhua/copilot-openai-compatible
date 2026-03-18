/**
 * Copilot SDK client manager.
 *
 * Manages a shared CopilotClient instance (one per process) that connects to the
 * Copilot CLI.  A fresh session is created per proxy request so that conversation
 * context is isolated, and the session is deleted after the request completes.
 *
 * Authentication:
 *   - Default: the bundled CLI uses the logged-in user's stored credentials
 *     (set via `gh auth login` / Copilot CLI `copilot auth login`).
 *   - Server-side token: set GITHUB_TOKEN (or GH_TOKEN) and the client will
 *     pass it directly to the Copilot CLI process.
 *   - Passthrough mode (ENABLE_PASSTHROUGH=true): the caller may supply a
 *     GitHub token via the X-GitHub-Token request header; the proxy creates a
 *     dedicated CopilotClient for that token.  The token is never logged.
 */

import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { ModelInfo } from "@github/copilot-sdk";
import type { Config } from "../config.js";
import type { ChatMessage } from "../types/openai.js";
import { mapModelId } from "../types/models.js";

export interface GenerateOptions {
  messages: ChatMessage[];
  model: string;
  /** If true, stream tokens via onDelta callback */
  stream?: boolean;
  /** Called for each streaming delta token */
  onDelta?: (token: string) => void;
  /** Called when a session error event is received */
  onError?: (err: { message: string; errorType: string }) => void;
  /** Timeout in milliseconds for sendAndWait (default: 120 000) */
  timeoutMs?: number;
}

export interface GenerateResult {
  content: string;
}

/**
 * Build a CopilotClientOptions-compatible options object.
 * Accepts an optional GitHub token for passthrough mode.
 */
function buildClientOptions(githubToken?: string) {
  if (githubToken) {
    return {
      githubToken,
      useLoggedInUser: false as const,
    };
  }
  return {};
}

/**
 * Convert an OpenAI messages array into:
 *   - systemContent: combined text of all system messages
 *   - prompt: the final user/assistant turn(s) formatted for Copilot
 *
 * The Copilot SDK's `sendAndWait` accepts a single `prompt` string, so we
 * concatenate the conversation history (excluding system messages) into a
 * single string and pass system messages via `sessionConfig.systemMessage`.
 */
function buildPromptAndSystem(messages: ChatMessage[]): {
  systemContent: string | undefined;
  prompt: string;
} {
  const systemParts: string[] = [];
  const historyParts: string[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      const prefix = msg.role === "assistant" ? "Assistant" : "User";
      historyParts.push(`${prefix}: ${msg.content}`);
    }
  }

  const systemContent = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
  const prompt =
    historyParts.length > 0
      ? historyParts.join("\n\n")
      : // Fallback: shouldn't happen for valid requests
        "Hello";

  return { systemContent, prompt };
}

/**
 * Perform a single chat generation using the Copilot SDK.
 *
 * For non-streaming calls: creates a session, sends the prompt, waits for the
 * full response, deletes the session, and returns the content.
 *
 * For streaming calls: creates a session, subscribes to delta events, sends the
 * prompt while calling onDelta for each token, then cleans up.
 */
export async function generate(
  config: Config,
  options: GenerateOptions,
  passthroughToken?: string,
): Promise<GenerateResult> {
  const { messages, model, stream, onDelta, onError, timeoutMs = 120_000 } = options;
  const copilotModel = mapModelId(model);

  const githubToken = passthroughToken ?? config.githubToken;
  const clientOptions = buildClientOptions(githubToken);

  const client = new CopilotClient(clientOptions);

  let session;
  try {
    const { systemContent, prompt } = buildPromptAndSystem(messages);

    const sessionConfig = {
      model: copilotModel,
      streaming: stream === true,
      onPermissionRequest: approveAll,
      ...(systemContent
        ? { systemMessage: { mode: "append" as const, content: systemContent } }
        : {}),
    };

    session = await client.createSession(sessionConfig);

    if (stream && onDelta) {
      // Subscribe to streaming delta events
      session.on("assistant.message_delta", (event) => {
        onDelta(event.data.deltaContent);
      });
    }

    // Subscribe to error events
    session.on("session.error", (event) => {
      if (onError) {
        onError({ message: event.data.message, errorType: event.data.errorType });
      }
    });

    const response = await session.sendAndWait({ prompt }, timeoutMs);
    const content = response?.data.content ?? "";

    return { content };
  } finally {
    // Clean up: delete the session to free resources
    if (session) {
      try {
        await client.deleteSession(session.sessionId);
      } catch {
        // Best-effort cleanup; ignore errors
      }
    }
    await client.stop().catch(() => {});
  }
}

/**
 * List available Copilot models.
 * Uses a short-lived client connection.
 */
export async function listCopilotModels(config: Config): Promise<ModelInfo[]> {
  const clientOptions = buildClientOptions(config.githubToken);
  const client = new CopilotClient(clientOptions);
  try {
    return await client.listModels();
  } finally {
    await client.stop().catch(() => {});
  }
}
