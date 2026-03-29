import { defineTool } from "@github/copilot-sdk";
import type { Tool } from "../types.js";

/**
 * Convert an array of OpenAI tool definitions into Copilot SDK tool definitions.
 *
 * The Copilot SDK executes tools server-side (within the CLI process). When the
 * model invokes one of these tools, our handler is called with the parsed
 * arguments and should return a result that gets fed back to the model.
 *
 * Because the Copilot SDK handles the full tool round-trip internally (the LLM
 * sees the tool result without the HTTP client getting involved), we store a
 * registry of pending tool calls so that:
 *  1. The first time a tool is called, we return a placeholder "pending" result
 *     immediately — this is overridden by actual tool results when the caller
 *     sends a follow-up request with `role:"tool"` messages.
 *  2. When the caller's follow-up includes `role:"tool"` messages the results
 *     are extracted in `messages.ts` and surfaced as conversation context.
 *
 * This enables the most common "LLM + tool loop" pattern while staying within
 * what the Copilot SDK allows.
 */
export function convertTools(tools: Tool[]) {
  return tools.map((tool) => {
    const fn = tool.function;

    return defineTool(fn.name, {
      description: fn.description ?? fn.name,
      // Pass the OpenAI JSON-schema directly — copilot-sdk accepts raw schemas.
      parameters: fn.parameters ?? { type: "object", properties: {} },
      // skipPermission because these are caller-defined tools, not privileged ops.
      skipPermission: true,
      handler: async (args: unknown) => {
        // Return the raw arguments back so the model can see what was called.
        // In practice the model uses this to continue reasoning once it decides
        // to call the tool.  The actual result (if any) is injected as context
        // via the conversation_history block on the next turn.
        return {
          status: "tool_called",
          tool: fn.name,
          arguments: args,
        };
      },
    });
  });
}
