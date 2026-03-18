/**
 * Rate-limiting middleware.
 *
 * Defaults: 60 requests per minute per IP.
 * Tune via environment variables:
 *   RATE_LIMIT_WINDOW_MS   – window in milliseconds (default: 60000)
 *   RATE_LIMIT_MAX          – max requests per window (default: 60)
 */

import rateLimit from 'express-rate-limit';

export const rateLimitMiddleware = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many requests – please slow down.',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded',
    },
  },
  // Skip rate-limiting in test environment
  skip: () => process.env.NODE_ENV === 'test',
});
