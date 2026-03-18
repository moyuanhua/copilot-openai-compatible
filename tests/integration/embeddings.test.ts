/**
 * Integration tests for the embeddings endpoint.
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import type { Config } from "../../src/config.js";
import { createApp } from "../../src/app.js";

// Mock the Copilot SDK client module so no real CLI is needed
vi.mock("../../src/copilot/client.js", () => ({
  generate: vi.fn(),
  listCopilotModels: vi.fn().mockResolvedValue([]),
}));

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

describe("POST /v1/embeddings", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app)
      .post("/v1/embeddings")
      .send({ model: "text-embedding-ada-002", input: "hello" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/v1/embeddings")
      .set("Authorization", AUTH)
      .send({ input: "hello" }); // missing model
    expect(res.status).toBe(400);
  });

  it("returns embeddings for string input", async () => {
    const res = await request(app)
      .post("/v1/embeddings")
      .set("Authorization", AUTH)
      .send({ model: "text-embedding-ada-002", input: "hello world" });

    expect(res.status).toBe(200);
    expect(res.body.object).toBe("list");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].object).toBe("embedding");
    expect(res.body.data[0].index).toBe(0);
    expect(Array.isArray(res.body.data[0].embedding)).toBe(true);
    expect(res.body.data[0].embedding).toHaveLength(1536);
    expect(res.body.model).toBe("text-embedding-ada-002");
  });

  it("returns embeddings for array input", async () => {
    const res = await request(app)
      .post("/v1/embeddings")
      .set("Authorization", AUTH)
      .send({ model: "text-embedding-ada-002", input: ["hello", "world"] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].index).toBe(0);
    expect(res.body.data[1].index).toBe(1);
  });

  it("includes usage stats", async () => {
    const res = await request(app)
      .post("/v1/embeddings")
      .set("Authorization", AUTH)
      .send({ model: "text-embedding-ada-002", input: "test" });

    expect(res.body.usage).toBeDefined();
    expect(typeof res.body.usage.prompt_tokens).toBe("number");
    expect(typeof res.body.usage.total_tokens).toBe("number");
  });
});
