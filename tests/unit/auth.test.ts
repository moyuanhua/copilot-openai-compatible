/**
 * Unit tests for auth middleware.
 */

import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { extractPassthroughToken } from "../../src/middleware/auth.js";
import type { Config } from "../../src/config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 3000,
    proxyApiKey: "test-key",
    githubToken: undefined,
    enablePassthrough: false,
    logLevel: "none",
    rateLimitMax: 60,
    rateLimitWindowMs: 60_000,
    defaultModel: "gpt-4.1",
    ...overrides,
  };
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

describe("extractPassthroughToken", () => {
  it("returns undefined when passthrough is disabled", () => {
    const req = makeRequest({ "x-github-token": "ghp_token" });
    const config = makeConfig({ enablePassthrough: false });
    expect(extractPassthroughToken(req, config)).toBeUndefined();
  });

  it("returns undefined when header is absent and passthrough is enabled", () => {
    const req = makeRequest({});
    const config = makeConfig({ enablePassthrough: true });
    expect(extractPassthroughToken(req, config)).toBeUndefined();
  });

  it("returns token when passthrough is enabled and header is present", () => {
    const req = makeRequest({ "x-github-token": "ghp_abc123" });
    const config = makeConfig({ enablePassthrough: true });
    expect(extractPassthroughToken(req, config)).toBe("ghp_abc123");
  });

  it("returns undefined for empty string token", () => {
    const req = makeRequest({ "x-github-token": "" });
    const config = makeConfig({ enablePassthrough: true });
    expect(extractPassthroughToken(req, config)).toBeUndefined();
  });
});
