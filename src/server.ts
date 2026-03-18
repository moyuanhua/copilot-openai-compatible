/**
 * Entry point — starts the HTTP server.
 */

import { loadConfig } from "./config.js";
import { loadCustomModelMap } from "./types/models.js";
import { createApp } from "./app.js";

const config = loadConfig();
loadCustomModelMap();

const app = createApp(config);

const server = app.listen(config.port, () => {
  console.log(
    `[server] OpenAI-compatible Copilot proxy listening on http://0.0.0.0:${config.port}`,
  );
  console.log(`[server] Passthrough mode: ${config.enablePassthrough}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received — shutting down");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[server] SIGINT received — shutting down");
  server.close(() => process.exit(0));
});
