/**
 * OpenAI-compatible type definitions.
 *
 * These mirror the subset of OpenAI's REST API surface used by common clients
 * (including @ai-sdk/openai-compatible). Only the fields required for proxy
 * operation are included.
 */

// ── Messages ──────────────────────────────────────────────────────────────────

export type MessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// ── Chat completion request ───────────────────────────────────────────────────

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  /** Sampling temperature (0–2). Ignored by Copilot SDK; accepted for compatibility. */
  temperature?: number;
  /** Maximum tokens to generate. */
  max_tokens?: number;
  /** Nucleus sampling parameter. Ignored by Copilot SDK; accepted for compatibility. */
  top_p?: number;
  /** Stop sequence(s). */
  stop?: string | string[];
  /** Number of completions to generate. Only n=1 is supported. */
  n?: number;
  /** Whether to stream the response. */
  stream?: boolean;
  /** User identifier for abuse tracking. */
  user?: string;
}

// ── Chat completion response (non-streaming) ─────────────────────────────────

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: UsageStats;
}

// ── Chat completion chunk (streaming) ────────────────────────────────────────

export interface ChatCompletionChunkDelta {
  role?: MessageRole;
  content?: string;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

// ── Embeddings ────────────────────────────────────────────────────────────────

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: "float" | "base64";
  user?: string;
}

export interface EmbeddingObject {
  object: "embedding";
  index: number;
  embedding: number[];
}

export interface EmbeddingResponse {
  object: "list";
  data: EmbeddingObject[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ── Models ────────────────────────────────────────────────────────────────────

export interface ModelObject {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  object: "list";
  data: ModelObject[];
}

// ── Error ─────────────────────────────────────────────────────────────────────

export interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string | null;
    param: string | null;
  };
}
