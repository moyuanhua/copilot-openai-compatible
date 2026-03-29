// ─── OpenAI-compatible request / response types ───────────────────────────────

export type MessageRole = "system" | "user" | "assistant" | "tool" | "function";

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

export interface Message {
  role: MessageRole;
  /** string or multipart content array */
  content: string | ContentPart[] | null;
  name?: string;
  /** present when role === "assistant" and tool_calls were generated */
  tool_calls?: ToolCall[];
  /** present when role === "tool" */
  tool_call_id?: string;
}

// ─── Tool / Function calling ───────────────────────────────────────────────────

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface Tool {
  type: "function";
  function: FunctionDefinition;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON-serialised
  };
}

export type ToolChoice =
  | "none"
  | "auto"
  | "required"
  | { type: "function"; function: { name: string } };

// ─── Chat completion request ───────────────────────────────────────────────────

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  /** stop sequence(s) */
  stop?: string | string[];
  tools?: Tool[];
  tool_choice?: ToolChoice;
  /** Session-id is read from X-Session-Id header, not from the body */
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ─── Non-streaming response ───────────────────────────────────────────────────

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
}

// ─── Streaming chunk ──────────────────────────────────────────────────────────

export interface ChatCompletionChunkDelta {
  role?: "assistant";
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

// ─── Models list ──────────────────────────────────────────────────────────────

export interface ModelObject {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export interface ModelsListResponse {
  object: "list";
  data: ModelObject[];
}

// ─── Static model catalogue – all models supported by GitHub Copilot ─────────
// Source: https://docs.github.com/en/copilot/using-github-copilot/ai-models/supported-ai-models-in-copilot
// Premium request multipliers: https://docs.github.com/en/copilot/managing-copilot/monitoring-usage-and-entitlements/about-premium-requests

export const COPILOT_MODELS: ModelObject[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  // GPT-4.1 and GPT-5 mini are "included" models on paid plans (0x premium requests)
  { id: "gpt-4.1",              object: "model", created: 1743465600, owned_by: "github-copilot" },
  { id: "gpt-5-mini",           object: "model", created: 1746057600, owned_by: "github-copilot" },
  // Closing down 2026-04-01
  { id: "gpt-5.1",              object: "model", created: 1740960000, owned_by: "github-copilot" },
  { id: "gpt-5.1-codex",        object: "model", created: 1740960000, owned_by: "github-copilot" },
  { id: "gpt-5.1-codex-max",    object: "model", created: 1740960000, owned_by: "github-copilot" },
  { id: "gpt-5.1-codex-mini",   object: "model", created: 1740960000, owned_by: "github-copilot" },
  // GA models
  { id: "gpt-5.2",              object: "model", created: 1743465600, owned_by: "github-copilot" },
  { id: "gpt-5.2-codex",        object: "model", created: 1743465600, owned_by: "github-copilot" },
  { id: "gpt-5.3-codex",        object: "model", created: 1746057600, owned_by: "github-copilot" },
  { id: "gpt-5.4",              object: "model", created: 1748736000, owned_by: "github-copilot" },
  { id: "gpt-5.4-mini",         object: "model", created: 1748736000, owned_by: "github-copilot" },
  // ── Anthropic ───────────────────────────────────────────────────────────────
  { id: "claude-haiku-4.5",     object: "model", created: 1740960000, owned_by: "github-copilot" },
  { id: "claude-opus-4.5",      object: "model", created: 1740960000, owned_by: "github-copilot" },
  { id: "claude-opus-4.6",      object: "model", created: 1746057600, owned_by: "github-copilot" },
  { id: "claude-opus-4.6-fast", object: "model", created: 1746057600, owned_by: "github-copilot" }, // public preview
  { id: "claude-sonnet-4",      object: "model", created: 1735689600, owned_by: "github-copilot" },
  { id: "claude-sonnet-4.5",    object: "model", created: 1740960000, owned_by: "github-copilot" },
  { id: "claude-sonnet-4.6",    object: "model", created: 1746057600, owned_by: "github-copilot" },
  // ── Google ──────────────────────────────────────────────────────────────────
  { id: "gemini-2.5-pro",       object: "model", created: 1744675200, owned_by: "github-copilot" },
  { id: "gemini-3-flash",       object: "model", created: 1748736000, owned_by: "github-copilot" }, // public preview
  { id: "gemini-3.1-pro",       object: "model", created: 1751328000, owned_by: "github-copilot" }, // public preview
  // ── xAI ─────────────────────────────────────────────────────────────────────
  { id: "grok-code-fast-1",     object: "model", created: 1754006400, owned_by: "github-copilot" },
  // ── Fine-tuned (GitHub Copilot) ──────────────────────────────────────────────
  { id: "raptor-mini",          object: "model", created: 1748736000, owned_by: "github-copilot" }, // public preview; fine-tuned GPT-5 mini
  { id: "goldeneye",            object: "model", created: 1748736000, owned_by: "github-copilot" }, // public preview; fine-tuned GPT-5.1-Codex
];

// Default model when none is specified (included model on paid plans, no premium requests consumed)
export const DEFAULT_MODEL = "gpt-5-mini";

// ─── Model alias / normalisation map ─────────────────────────────────────────
// Maps common aliases, legacy names, and typos → canonical Copilot model IDs.
// Applied before any request reaches the SDK so unknown names fail fast.
export const MODEL_ALIASES: Record<string, string> = {
  // Legacy OpenAI names still widely used by clients
  "gpt-4o":               "gpt-4.1",
  "gpt-4o-mini":          "gpt-5-mini",
  "gpt-4-turbo":          "gpt-4.1",
  "gpt-4":                "gpt-4.1",
  "gpt-3.5-turbo":        "gpt-5-mini",
  "gpt-3.5-turbo-16k":    "gpt-5-mini",
  // Common typos
  "gtp-5-mini":           "gpt-5-mini",
  "gpt5-mini":            "gpt-5-mini",
  "gpt-5mini":            "gpt-5-mini",
  "gpt5mini":             "gpt-5-mini",
  "gpt-4.1-mini":         "gpt-5-mini",
  // Anthropic aliases
  "claude-3-5-sonnet":    "claude-sonnet-4.5",
  "claude-3-opus":        "claude-opus-4.5",
  "claude-3-haiku":       "claude-haiku-4.5",
  "claude-sonnet":        "claude-sonnet-4.6",
  "claude-opus":          "claude-opus-4.6",
  "claude-haiku":         "claude-haiku-4.5",
  // Gemini aliases
  "gemini-pro":           "gemini-2.5-pro",
  "gemini-1.5-pro":       "gemini-2.5-pro",
  "gemini-flash":         "gemini-3-flash",
};

/** Resolve a model name: apply aliases, return canonical ID or undefined if not found. */
export function resolveModel(requested: string): string | undefined {
  const lower = requested.toLowerCase();
  // Direct match in catalogue
  if (COPILOT_MODELS.some(m => m.id === lower)) return lower;
  // Alias lookup
  return MODEL_ALIASES[lower];
}
