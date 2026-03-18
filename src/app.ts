/**
 * Express application factory.
 *
 * Exported as a function so tests can create isolated instances without
 * starting the HTTP server or the Copilot CLI.
 */

import express from 'express';
import { loggerMiddleware } from './middleware/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import chatRouter from './routes/chat.js';
import modelsRouter from './routes/models.js';
import embeddingsRouter from './routes/embeddings.js';

export function createApp(): express.Application {
  const app = express();

  // ── Body parsing ────────────────────────────────────────────────────────
  app.use(express.json({ limit: '4mb' }));

  // ── Observability ───────────────────────────────────────────────────────
  app.use(loggerMiddleware);

  // ── Rate limiting ───────────────────────────────────────────────────────
  app.use(rateLimitMiddleware);

  // ── Authentication ──────────────────────────────────────────────────────
  app.use(authMiddleware);

  // ── Routes ──────────────────────────────────────────────────────────────
  app.use('/v1/chat/completions', chatRouter);
  app.use('/v1/models', modelsRouter);
  app.use('/v1/embeddings', embeddingsRouter);

  // ── Health check (unauthenticated) ──────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // ── 404 fallback ────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        message: 'Not found.',
        type: 'not_found_error',
        code: 'endpoint_not_found',
      },
    });
  });

  return app;
}
