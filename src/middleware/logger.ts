/**
 * Request / response logging middleware.
 *
 * Logs method, path, status code, and latency.
 * Never logs Authorization headers or request bodies to avoid leaking keys.
 */

import { Request, Response, NextFunction } from 'express';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path: reqPath } = req;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${level}] ${method} ${reqPath} → ${res.statusCode} (${ms}ms)`);
  });

  next();
}
