/**
 * Authentication middleware.
 *
 * Every request must include an Authorization header matching the configured
 * PROXY_API_KEY:
 *
 *   Authorization: Bearer <PROXY_API_KEY>
 *
 * When PROXY_API_KEY is empty the middleware rejects all requests to avoid
 * accidental open access.
 *
 * Passthrough mode (ENABLE_PASSTHROUGH=true):
 *   Clients may additionally supply a GitHub personal access token via the
 *   X-GitHub-Token header.  The proxy will forward this token to the Copilot
 *   SDK instead of using the server-side GITHUB_TOKEN.  The token is never
 *   logged or included in responses.
 */

import type { Request, Response, NextFunction } from "express";
import type { Config } from "../config.js";

export function createAuthMiddleware(config: Config) {
  return function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Reject if no proxy key is configured
    if (!config.proxyApiKey) {
      res.status(500).json({
        error: {
          message: "Proxy is misconfigured: PROXY_API_KEY is not set.",
          type: "server_error",
          code: "proxy_misconfigured",
          param: null,
        },
      });
      return;
    }

    const authHeader = req.headers["authorization"] ?? "";
    const expectedToken = `Bearer ${config.proxyApiKey}`;

    if (authHeader !== expectedToken) {
      res.status(401).json({
        error: {
          message: "Invalid API key. Provide a valid Bearer token in the Authorization header.",
          type: "invalid_request_error",
          code: "invalid_api_key",
          param: null,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Extract a passthrough GitHub token from the request headers.
 * Returns undefined when passthrough mode is disabled or no token is present.
 */
export function extractPassthroughToken(req: Request, config: Config): string | undefined {
  if (!config.enablePassthrough) return undefined;
  const token = req.headers["x-github-token"];
  if (typeof token === "string" && token.length > 0) return token;
  return undefined;
}
