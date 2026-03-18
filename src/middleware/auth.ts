/**
 * Authentication middleware.
 *
 * External callers must supply  Authorization: Bearer <PROXY_API_KEY>
 * The key is configured via the PROXY_API_KEY environment variable.
 *
 * This key is never forwarded to the Copilot SDK; it is purely for
 * protecting the proxy itself.
 */

import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const proxyApiKey = process.env.PROXY_API_KEY;

  // If PROXY_API_KEY is not set we log a warning on startup (see server.ts)
  // but still require a key at runtime when the variable is present.
  if (!proxyApiKey) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || token !== proxyApiKey) {
    res.status(401).json({
      error: {
        message: 'Unauthorized – provide a valid Bearer token in the Authorization header.',
        type: 'authentication_error',
        code: 'invalid_api_key',
      },
    });
    return;
  }

  next();
}
