/**
 * Example: Using the proxy with @ai-sdk/openai-compatible
 *
 * Install the dependency first:
 *   npm install @ai-sdk/openai-compatible ai
 *
 * Run with:
 *   PROXY_API_KEY=your-key npx tsx examples/client.ts
 */

// NOTE: In a real project you would import from the installed packages.
// The imports below are illustrative; uncomment and adjust as needed.
//
// import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
// import { generateText, streamText } from "ai";

import type { CopilotModelId } from "../src/types/models.js";

const BASE_URL = process.env["PROXY_BASE_URL"] ?? "http://localhost:3000/v1";
const API_KEY = process.env["PROXY_API_KEY"] ?? "change-me";

// ── 1. Using @ai-sdk/openai-compatible ────────────────────────────────────────
//
// const provider = createOpenAICompatible<CopilotModelId, CopilotModelId, CopilotModelId>({
//   baseURL: BASE_URL,
//   name: "copilot-proxy",
//   apiKey: API_KEY,
// });
//
// Non-streaming:
// const { text } = await generateText({
//   model: provider.chatModel("gpt-4.1"),
//   prompt: "Write a short poem about TypeScript.",
// });
// console.log(text);
//
// Streaming:
// const { textStream } = await streamText({
//   model: provider.chatModel("gpt-4.1"),
//   prompt: "Tell me a short joke.",
// });
// for await (const chunk of textStream) {
//   process.stdout.write(chunk);
// }
// console.log();

// ── 2. Using raw fetch (no SDK required) ─────────────────────────────────────

async function chatNonStreaming() {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1" satisfies CopilotModelId,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is 2 + 2?" },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  console.log("Non-streaming response:", data.choices[0]?.message.content);
}

async function chatStreaming() {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1" satisfies CopilotModelId,
      messages: [{ role: "user", content: "Count to 5 slowly." }],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  process.stdout.write("Streaming response: ");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") {
        process.stdout.write("\n");
        return;
      }
      try {
        const chunk = JSON.parse(payload) as {
          choices: Array<{ delta: { content?: string } }>;
        };
        const content = chunk.choices[0]?.delta.content ?? "";
        process.stdout.write(content);
      } catch {
        // Skip unparseable lines
      }
    }
  }
}

async function listModels() {
  const response = await fetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const data = (await response.json()) as { data: Array<{ id: string }> };
  console.log(
    "Available models:",
    data.data.map((m) => m.id),
  );
}

// ── Run examples ──────────────────────────────────────────────────────────────

console.log(`Connecting to proxy at ${BASE_URL}\n`);

listModels()
  .then(() => chatNonStreaming())
  .then(() => chatStreaming())
  .catch(console.error);
