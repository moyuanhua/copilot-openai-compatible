/**
 * Integration tests for the models endpoint.
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import type { Config } from "../../src/config.js";
import { createApp } from "../../src/app.js";

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

describe("GET /v1/models", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/v1/models");
    expect(res.status).toBe(401);
  });

  it("returns model list", async () => {
    const res = await request(app).get("/v1/models").set("Authorization", AUTH);

    expect(res.status).toBe(200);
    expect(res.body.object).toBe("list");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("each model has the correct shape", async () => {
    const res = await request(app).get("/v1/models").set("Authorization", AUTH);

    for (const model of res.body.data) {
      expect(model.object).toBe("model");
      expect(typeof model.id).toBe("string");
      expect(typeof model.created).toBe("number");
      expect(typeof model.owned_by).toBe("string");
    }
  });

  it("returns live models from Copilot SDK when available", async () => {
    const { listCopilotModels } = await import("../../src/copilot/client.js");
    vi.mocked(listCopilotModels).mockResolvedValueOnce([
      {
        id: "live-model-1",
        name: "Live Model 1",
        capabilities: {
          type: "chat",
          family: "gpt",
          limits: { maxContextWindowTokens: 128000 },
          supports: {},
        },
      },
    ] as never);

    const res = await request(app).get("/v1/models").set("Authorization", AUTH);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((m: { id: string }) => m.id);
    expect(ids).toContain("live-model-1");
  });
});
