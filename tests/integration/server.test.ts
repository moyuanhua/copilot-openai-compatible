/**
 * Integration tests for the server (health, metrics, 404).
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

describe("Server", () => {
  it("GET /health returns 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /metrics returns metrics object", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(typeof res.body.requestCount).toBe("number");
    expect(typeof res.body.errorCount).toBe("number");
    expect(typeof res.body.totalLatencyMs).toBe("number");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("returns 404 for unknown /v1 routes", async () => {
    const res = await request(app).get("/v1/unknown").set("Authorization", "Bearer test-proxy-key");
    expect(res.status).toBe(404);
  });
});
