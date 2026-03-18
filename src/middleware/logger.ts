/**
 * Request logging middleware with basic metrics.
 *
 * Logs method, path, status, and latency for every request.
 * Tracks aggregate counters (request count, error count, total latency) that
 * can be exposed via a /metrics endpoint.
 */

import type { Request, Response, NextFunction } from "express";
import type { Config } from "../config.js";

export interface Metrics {
  requestCount: number;
  errorCount: number;
  totalLatencyMs: number;
}

const metrics: Metrics = {
  requestCount: 0,
  errorCount: 0,
  totalLatencyMs: 0,
};

export function getMetrics(): Readonly<Metrics> {
  return { ...metrics };
}

export function resetMetrics(): void {
  metrics.requestCount = 0;
  metrics.errorCount = 0;
  metrics.totalLatencyMs = 0;
}

export function createLoggerMiddleware(config: Config) {
  const silent = config.logLevel === "none";

  return function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    metrics.requestCount++;

    res.on("finish", () => {
      const latency = Date.now() - start;
      metrics.totalLatencyMs += latency;
      if (res.statusCode >= 400) metrics.errorCount++;

      if (!silent) {
        const level = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
        console.log(`[${level}] ${req.method} ${req.path} → ${res.statusCode} (${latency}ms)`);
      }
    });

    next();
  };
}
