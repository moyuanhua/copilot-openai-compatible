/**
 * Model mapping layer.
 *
 * Maps client-facing model IDs (typically OpenAI names) to Copilot-compatible
 * model IDs, and exposes a well-known list of supported models.
 *
 * The mapping can be extended by setting CUSTOM_MODEL_MAP in the environment
 * as a JSON string, e.g.:
 *   CUSTOM_MODEL_MAP='{"my-model":"gpt-4.1"}'
 */

/**
 * Default mapping from common OpenAI / generic identifiers → Copilot model IDs.
 * Clients may send either the OpenAI name or the Copilot name directly.
 */
export const DEFAULT_MODEL_MAP: Record<string, string> = {
  // GPT-4.x family
  "gpt-4": "gpt-4.1",
  "gpt-4-turbo": "gpt-4.1",
  "gpt-4o": "gpt-4o",
  "gpt-4.1": "gpt-4.1",
  "gpt-4.1-mini": "gpt-4.1-mini",
  "gpt-4o-mini": "gpt-4o-mini",
  // GPT-3.5 family (maps to a cheaper model)
  "gpt-3.5-turbo": "gpt-4.1-mini",
  // Claude family
  "claude-3-5-sonnet": "claude-sonnet-4.5",
  "claude-3-5-haiku": "claude-haiku-4.5",
  "claude-sonnet-4.5": "claude-sonnet-4.5",
  "claude-haiku-4.5": "claude-haiku-4.5",
  // o1 family
  o1: "o1",
  "o1-mini": "o1-mini",
  "o3-mini": "o3-mini",
};

/** All model IDs that the proxy advertises in GET /v1/models */
export const SUPPORTED_MODELS: string[] = [
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "claude-sonnet-4.5",
  "claude-haiku-4.5",
  "o1",
  "o1-mini",
  "o3-mini",
];

/**
 * Well-known Copilot model IDs for TypeScript autocomplete support.
 * Clients using @ai-sdk/openai-compatible can use this type for model IDs.
 */
export type CopilotModelId =
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "claude-sonnet-4.5"
  | "claude-haiku-4.5"
  | "o1"
  | "o1-mini"
  | "o3-mini"
  | (string & NonNullable<unknown>); // allow arbitrary strings while keeping autocomplete

let _modelMap: Record<string, string> = { ...DEFAULT_MODEL_MAP };

/**
 * Load custom model map from the CUSTOM_MODEL_MAP environment variable and merge
 * it with the default map. Should be called once at startup.
 */
export function loadCustomModelMap(): void {
  const raw = process.env["CUSTOM_MODEL_MAP"];
  if (!raw) return;
  try {
    const custom = JSON.parse(raw) as Record<string, string>;
    _modelMap = { ...DEFAULT_MODEL_MAP, ...custom };
  } catch {
    console.warn("[models] Failed to parse CUSTOM_MODEL_MAP — using defaults.");
  }
}

/**
 * Map a client-provided model ID to a Copilot-compatible model ID.
 * Falls back to the original ID when no mapping is found (passthrough).
 */
export function mapModelId(clientModelId: string): string {
  return _modelMap[clientModelId] ?? clientModelId;
}
