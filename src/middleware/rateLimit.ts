/**
 * Rate-limiting middleware.
 *
 * Uses express-rate-limit to apply per-key (Authorization token) limits.
 * Defaults: 60 requests / 60 seconds — overridable via RATE_LIMIT_MAX and
 * RATE_LIMIT_WINDOW_MS environment variables.
 */

import rateLimit from "express-rate-limit";
import type { Config } from "../config.js";

export function createRateLimiter(config: Config) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    // Key on the Authorization header so per-client limits apply even behind a proxy
    keyGenerator: (req) => {
      const auth = req.headers["authorization"] ?? req.ip ?? "unknown";
      return auth;
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          message: "Rate limit exceeded. Please slow down your requests.",
          type: "rate_limit_error",
          code: "rate_limit_exceeded",
          param: null,
        },
      });
    },
  });
}
