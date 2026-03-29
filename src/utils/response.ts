import { randomUUID } from "crypto";
import type {
  ChatCompletionResponse,
  ChatCompletionChunk,
  Usage,
} from "../types.js";

/** Generate a chat-completion style ID */
function makeId(): string {
  return `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

/**
 * Build a full (non-streaming) OpenAI chat completion response.
 */
export function makeCompletionResponse(
  model: string,
  content: string,
  usage: Partial<Usage> = {},
): ChatCompletionResponse {
  return {
    id: makeId(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: usage.prompt_tokens ?? 0,
      completion_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0,
    },
  };
}

/**
 * Build a single SSE streaming chunk encoded as the `data: ...\n\n` string.
 */
export function makeStreamChunk(
  id: string,
  model: string,
  deltaContent: string,
  finishReason: ChatCompletionChunk["choices"][0]["finish_reason"] = null,
): string {
  const chunk: ChatCompletionChunk = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          content: deltaContent,
        },
        finish_reason: finishReason,
      },
    ],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * First chunk that establishes role without content (mirrors OpenAI behaviour).
 */
export function makeStreamRoleChunk(id: string, model: string): string {
  const chunk: ChatCompletionChunk = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: "" },
        finish_reason: null,
      },
    ],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Final chunk with finish_reason + empty delta (mirrors OpenAI behaviour).
 */
export function makeStreamStopChunk(id: string, model: string): string {
  const chunk: ChatCompletionChunk = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/** The stream termination sentinel */
export const STREAM_DONE = "data: [DONE]\n\n";
