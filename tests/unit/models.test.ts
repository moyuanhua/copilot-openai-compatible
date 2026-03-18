/**
 * Unit tests for the model mapping layer.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  mapModelId,
  DEFAULT_MODEL_MAP,
  SUPPORTED_MODELS,
  loadCustomModelMap,
} from "../../src/types/models.js";

describe("mapModelId", () => {
  it("maps known OpenAI names to Copilot IDs", () => {
    expect(mapModelId("gpt-4")).toBe("gpt-4.1");
    expect(mapModelId("gpt-4-turbo")).toBe("gpt-4.1");
    expect(mapModelId("gpt-3.5-turbo")).toBe("gpt-4.1-mini");
  });

  it("passes through Copilot-native IDs unchanged", () => {
    expect(mapModelId("gpt-4.1")).toBe("gpt-4.1");
    expect(mapModelId("claude-sonnet-4.5")).toBe("claude-sonnet-4.5");
  });

  it("passes through unknown IDs unchanged", () => {
    expect(mapModelId("some-custom-model")).toBe("some-custom-model");
  });

  it("maps Claude aliases", () => {
    expect(mapModelId("claude-3-5-sonnet")).toBe("claude-sonnet-4.5");
    expect(mapModelId("claude-3-5-haiku")).toBe("claude-haiku-4.5");
  });

  it("maps o-series models", () => {
    expect(mapModelId("o1")).toBe("o1");
    expect(mapModelId("o1-mini")).toBe("o1-mini");
    expect(mapModelId("o3-mini")).toBe("o3-mini");
  });
});

describe("DEFAULT_MODEL_MAP", () => {
  it("is a non-empty object", () => {
    expect(typeof DEFAULT_MODEL_MAP).toBe("object");
    expect(Object.keys(DEFAULT_MODEL_MAP).length).toBeGreaterThan(0);
  });

  it("all values are non-empty strings", () => {
    for (const [, value] of Object.entries(DEFAULT_MODEL_MAP)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("SUPPORTED_MODELS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(SUPPORTED_MODELS)).toBe(true);
    expect(SUPPORTED_MODELS.length).toBeGreaterThan(0);
  });

  it("contains gpt-4.1", () => {
    expect(SUPPORTED_MODELS).toContain("gpt-4.1");
  });
});

describe("loadCustomModelMap", () => {
  const originalEnv = process.env["CUSTOM_MODEL_MAP"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["CUSTOM_MODEL_MAP"];
    } else {
      process.env["CUSTOM_MODEL_MAP"] = originalEnv;
    }
    // Reset to defaults by reloading (simulate)
    delete process.env["CUSTOM_MODEL_MAP"];
    loadCustomModelMap();
  });

  it("merges custom entries over defaults", () => {
    process.env["CUSTOM_MODEL_MAP"] = JSON.stringify({ "my-model": "gpt-4.1" });
    loadCustomModelMap();
    expect(mapModelId("my-model")).toBe("gpt-4.1");
  });

  it("ignores invalid JSON and logs a warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env["CUSTOM_MODEL_MAP"] = "not-valid-json";
    loadCustomModelMap();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
