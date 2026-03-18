/**
 * Entry point – starts the HTTP server.
 *
 * The Copilot CLI must be installed and authenticated before running this
 * server.  See README.md for setup instructions.
 */

import { createApp } from './app';
import { stopCopilotClient } from './copilot/client';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const PROXY_API_KEY = process.env.PROXY_API_KEY;

if (!PROXY_API_KEY) {
  console.warn(
    '[WARN] PROXY_API_KEY is not set. The proxy will accept any request without authentication. ' +
      'Set PROXY_API_KEY to secure the proxy.'
  );
}

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[INFO] Copilot OpenAI-compatible proxy listening on http://0.0.0.0:${PORT}`);
  console.log(`[INFO] Endpoints:`);
  console.log(`         POST /v1/chat/completions`);
  console.log(`         GET  /v1/models`);
  console.log(`         POST /v1/embeddings  (stub – not yet supported)`);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[INFO] Received ${signal} – shutting down…`);
  server.close(async () => {
    await stopCopilotClient();
    console.log('[INFO] Server stopped.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
