/**
 * Express application factory.
 *
 * Exported separately from server.ts so tests can import the app without
 * binding to a port.
 */

import express from "express";
import type { Config } from "./config.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createLoggerMiddleware, getMetrics } from "./middleware/logger.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { createChatRouter } from "./routes/chat.js";
import { createEmbeddingsRouter } from "./routes/embeddings.js";
import { createModelsRouter } from "./routes/models.js";

export function createApp(config: Config): express.Application {
  const app = express();

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: "4mb" }));

  // ── Global middleware ──────────────────────────────────────────────────────
  app.use(createLoggerMiddleware(config));
  app.use(createRateLimiter(config));

  // ── Health / metrics (no auth required) ───────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/metrics", (_req, res) => {
    res.json(getMetrics());
  });

  // ── Auth middleware (applied to all /v1/* routes) ──────────────────────────
  app.use("/v1", createAuthMiddleware(config));

  // ── API routes ─────────────────────────────────────────────────────────────
  app.use("/v1/chat/completions", createChatRouter(config));
  app.use("/v1/embeddings", createEmbeddingsRouter(config));
  app.use("/v1/models", createModelsRouter(config));

  // ── 404 handler ────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        message: "Not found",
        type: "invalid_request_error",
        code: "not_found",
        param: null,
      },
    });
  });

  // ── Global error handler ───────────────────────────────────────────────────
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error("[ERROR]", err.message);
      res.status(500).json({
        error: {
          message: "Internal server error",
          type: "server_error",
          code: "internal_error",
          param: null,
        },
      });
    },
  );

  return app;
}
