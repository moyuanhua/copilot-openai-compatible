import type { Request } from "express";

/**
 * Returns the session ID from the `X-Session-Id` request header,
 * or `undefined` if the header is absent (ephemeral request).
 */
export function resolveSessionId(req: Request): string | undefined {
  const header = req.headers["x-session-id"];
  if (!header) return undefined;
  const value = Array.isArray(header) ? header[0] : header;
  return value.trim() || undefined;
}
