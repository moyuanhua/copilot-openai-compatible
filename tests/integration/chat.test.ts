/**
 * Integration tests for the chat completions endpoint.
 *
 * The Copilot SDK is mocked so no real CLI or credentials are required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { Config } from "../../src/config.js";
import { createApp } from "../../src/app.js";

// ── Mock the Copilot SDK client module ────────────────────────────────────────

vi.mock("../../src/copilot/client.js", () => {
  return {
    generate: vi.fn(),
    listCopilotModels: vi.fn().mockResolvedValue([]),
  };
});

import { generate } from "../../src/copilot/client.js";

// ── Test config ───────────────────────────────────────────────────────────────

const testConfig: Config = {
  port: 3000,
  proxyApiKey: "test-proxy-key",
  githubToken: undefined,
  enablePassthrough: false,
  logLevel: "none",
  rateLimitMax: 1000,
  rateLimitWindowMs: 60_000,
  defaultModel: "gpt-4.1",
};

const app = createApp(testConfig);
const AUTH = `Bearer ${testConfig.proxyApiKey}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function validChatBody(overrides = {}) {
  return {
    model: "gpt-4.1",
    messages: [{ role: "user", content: "Hello" }],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /v1/chat/completions", () => {
  beforeEach(() => {
    vi.mocked(generate).mockReset();
  });

  describe("authentication", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await request(app).post("/v1/chat/completions").send(validChatBody());
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("invalid_api_key");
    });

    it("returns 401 when Authorization header is wrong", async () => {
      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", "Bearer wrong-key")
        .send(validChatBody());
      expect(res.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("returns 400 when model is missing", async () => {
      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send({ messages: [{ role: "user", content: "Hi" }] });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request_error");
    });

    it("returns 400 when messages array is empty", async () => {
      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send({ model: "gpt-4.1", messages: [] });
      expect(res.status).toBe(400);
    });

    it("returns 400 when a message has an invalid role", async () => {
      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send({ model: "gpt-4.1", messages: [{ role: "invalid", content: "hi" }] });
      expect(res.status).toBe(400);
    });
  });

  describe("non-streaming", () => {
    it("returns 200 with OpenAI-shaped response", async () => {
      vi.mocked(generate).mockResolvedValueOnce({ content: "Hello back!" });

      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send(validChatBody());

      expect(res.status).toBe(200);
      expect(res.body.object).toBe("chat.completion");
      expect(res.body.choices).toHaveLength(1);
      expect(res.body.choices[0].message.role).toBe("assistant");
      expect(res.body.choices[0].message.content).toBe("Hello back!");
      expect(res.body.choices[0].finish_reason).toBe("stop");
      expect(res.body.model).toBe("gpt-4.1");
    });

    it("includes id, created, usage fields", async () => {
      vi.mocked(generate).mockResolvedValueOnce({ content: "Answer" });

      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send(validChatBody());

      expect(res.body.id).toMatch(/^chatcmpl-/);
      expect(typeof res.body.created).toBe("number");
      expect(res.body.usage).toBeDefined();
    });

    it("returns 502 when SDK throws", async () => {
      vi.mocked(generate).mockRejectedValueOnce(new Error("SDK failure"));

      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send(validChatBody());

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe("copilot_error");
    });

    it("passes system messages to generate", async () => {
      vi.mocked(generate).mockResolvedValueOnce({ content: "ok" });

      await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send({
          model: "gpt-4.1",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello" },
          ],
        });

      const [, opts] = vi.mocked(generate).mock.calls[0]!;
      expect(opts.messages).toHaveLength(2);
      expect(opts.messages[0].role).toBe("system");
    });
  });

  describe("streaming", () => {
    it("returns SSE stream with proper chunks", async () => {
      vi.mocked(generate).mockImplementationOnce(async (_cfg, opts) => {
        opts.onDelta?.("Hello");
        opts.onDelta?.(" World");
        return { content: "Hello World" };
      });

      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .set("Accept", "text/event-stream")
        .send(validChatBody({ stream: true }));

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/event-stream");

      const body = res.text;
      expect(body).toContain("data:");
      expect(body).toContain("chat.completion.chunk");
      expect(body).toContain("Hello");
      expect(body).toContain(" World");
      expect(body).toContain("[DONE]");
    });

    it("includes role in the first chunk", async () => {
      vi.mocked(generate).mockResolvedValueOnce({ content: "" });

      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send(validChatBody({ stream: true }));

      const lines = res.text
        .split("\n")
        .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
      const firstChunk = JSON.parse(lines[0]!.replace("data: ", ""));
      expect(firstChunk.choices[0].delta.role).toBe("assistant");
    });

    it("sends [DONE] terminator", async () => {
      vi.mocked(generate).mockResolvedValueOnce({ content: "hi" });

      const res = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", AUTH)
        .send(validChatBody({ stream: true }));

      expect(res.text).toContain("data: [DONE]");
    });
  });
});
