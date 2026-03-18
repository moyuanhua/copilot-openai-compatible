/**
 * Unit tests for the config module.
 */

import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

const originalEnv = { ...process.env };

describe("loadConfig", () => {
  afterEach(() => {
    // Restore original environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("uses defaults when env vars are not set", () => {
    delete process.env["PORT"];
    delete process.env["PROXY_API_KEY"];
    delete process.env["GITHUB_TOKEN"];
    delete process.env["GH_TOKEN"];
    delete process.env["ENABLE_PASSTHROUGH"];
    delete process.env["LOG_LEVEL"];
    delete process.env["RATE_LIMIT_MAX"];
    delete process.env["RATE_LIMIT_WINDOW_MS"];
    delete process.env["DEFAULT_MODEL"];

    const config = loadConfig();
    expect(config.port).toBe(3000);
    expect(config.proxyApiKey).toBe("");
    expect(config.githubToken).toBeUndefined();
    expect(config.enablePassthrough).toBe(false);
    expect(config.logLevel).toBe("info");
    expect(config.rateLimitMax).toBe(60);
    expect(config.rateLimitWindowMs).toBe(60_000);
    expect(config.defaultModel).toBe("gpt-4.1");
  });

  it("reads PORT", () => {
    process.env["PORT"] = "8080";
    expect(loadConfig().port).toBe(8080);
  });

  it("reads PROXY_API_KEY", () => {
    process.env["PROXY_API_KEY"] = "secret-key";
    expect(loadConfig().proxyApiKey).toBe("secret-key");
  });

  it("reads GITHUB_TOKEN", () => {
    process.env["GITHUB_TOKEN"] = "ghp_token";
    expect(loadConfig().githubToken).toBe("ghp_token");
  });

  it("falls back to GH_TOKEN when GITHUB_TOKEN is absent", () => {
    delete process.env["GITHUB_TOKEN"];
    process.env["GH_TOKEN"] = "ghp_fallback";
    expect(loadConfig().githubToken).toBe("ghp_fallback");
  });

  it("reads ENABLE_PASSTHROUGH", () => {
    process.env["ENABLE_PASSTHROUGH"] = "true";
    expect(loadConfig().enablePassthrough).toBe(true);
    process.env["ENABLE_PASSTHROUGH"] = "false";
    expect(loadConfig().enablePassthrough).toBe(false);
  });

  it("accepts valid LOG_LEVEL values", () => {
    for (const level of ["none", "error", "warning", "info", "debug"] as const) {
      process.env["LOG_LEVEL"] = level;
      expect(loadConfig().logLevel).toBe(level);
    }
  });

  it("falls back to info for invalid LOG_LEVEL", () => {
    process.env["LOG_LEVEL"] = "verbose";
    expect(loadConfig().logLevel).toBe("info");
  });
});
