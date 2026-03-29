import type { Message, ContentPart } from "../types.js";

export interface ConvertedMessages {
  /** Content for the systemMessage.content field */
  systemContent: string | undefined;
  /**
   * History of prior turns (everything except the last user message)
   * formatted as a markdown block to be prepended to systemContent.
   */
  historyBlock: string | undefined;
  /** The last user-facing prompt to send via session.send({ prompt }) */
  lastUserPrompt: string;
}

/**
 * Extract plain text from a message content value.
 * Handles both string and multipart ContentPart[] formats.
 */
function extractText(content: string | ContentPart[] | null): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((p): p is ContentPart & { type: "text"; text: string } =>
      p.type === "text" && typeof p.text === "string",
    )
    .map((p) => p.text)
    .join("\n");
}

/**
 * Convert an OpenAI messages array into the components needed to drive a
 * Copilot session.
 *
 * Logic:
 *  1. All `role:"system"` messages are concatenated into `systemContent`.
 *  2. All prior user/assistant/tool turns (all except the very last user
 *     message) are formatted into a `historyBlock` that callers append to
 *     `systemContent` so the model has context.
 *  3. The last user message becomes `lastUserPrompt`.
 *
 * **Multi-turn reuse** (X-Session-Id header present): the session already holds
 * the history, so only `lastUserPrompt` should be sent.
 *
 * **New / ephemeral session**: pass both `systemContent + historyBlock` as the
 * system message so the model has full context.
 */
export function convertMessages(messages: Message[]): ConvertedMessages {
  // Collect system messages
  const systemParts: string[] = [];
  const conversationMessages: Message[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const text = extractText(msg.content);
      if (text) systemParts.push(text);
    } else {
      conversationMessages.push(msg);
    }
  }

  const systemContent = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;

  if (conversationMessages.length === 0) {
    return { systemContent, historyBlock: undefined, lastUserPrompt: "" };
  }

  // Find the last user message index
  let lastUserIdx = -1;
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    if (conversationMessages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  if (lastUserIdx === -1) {
    // No user message — use the last message as prompt regardless of role
    lastUserIdx = conversationMessages.length - 1;
  }

  const lastUserPrompt = extractText(conversationMessages[lastUserIdx].content);

  // Build history block from everything before the last user message
  const priorMessages = conversationMessages.slice(0, lastUserIdx);

  let historyBlock: string | undefined;
  if (priorMessages.length > 0) {
    const lines: string[] = ["<conversation_history>"];

    for (const msg of priorMessages) {
      const role = msg.role.toUpperCase();
      const text = extractText(msg.content);

      if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
        lines.push(`[${role}] (requested tool calls)`);
        for (const tc of msg.tool_calls) {
          lines.push(`  tool_call id=${tc.id} name=${tc.function.name}`);
          lines.push(`  args: ${tc.function.arguments}`);
        }
      } else if (msg.role === "tool") {
        lines.push(`[TOOL RESULT] id=${msg.tool_call_id ?? "unknown"}`);
        if (text) lines.push(text);
      } else {
        if (text) lines.push(`[${role}] ${text}`);
      }
    }

    lines.push("</conversation_history>");
    historyBlock = lines.join("\n");
  }

  return { systemContent, historyBlock, lastUserPrompt };
}

/**
 * Build the full system message content by combining the caller-supplied
 * system message with the conversation history block.
 */
export function buildSystemContent(
  systemContent: string | undefined,
  historyBlock: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (systemContent) parts.push(systemContent);
  if (historyBlock) parts.push(historyBlock);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}
