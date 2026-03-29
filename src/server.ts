import "dotenv/config";
import express from "express";
import { getCopilotClient, stopCopilotClient } from "./client.js";
import { SessionManager } from "./session-manager.js";
import { modelsRouter } from "./routes/models.js";
import { createChatRouter } from "./routes/chat.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS ?? "600000", 10);

async function main() {
  // ── Start Copilot client ────────────────────────────────────────────────────
  const client = await getCopilotClient();

  // ── Session manager ─────────────────────────────────────────────────────────
  const sessionManager = new SessionManager(client, SESSION_TTL_MS);

  // ── Express app ─────────────────────────────────────────────────────────────
  const app = express();

  // Parse JSON bodies (limit 10 MB to allow reasonably large context)
  app.use(express.json({ limit: "10mb" }));

  // ── Routes ───────────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/v1/models", modelsRouter);
  app.use("/v1/chat/completions", createChatRouter(sessionManager));

  // Catch-all 404
  app.use((_req, res) => {
    res.status(404).json({ error: { message: "Not found", type: "invalid_request_error" } });
  });

  // ── Start server ─────────────────────────────────────────────────────────────
  const server = app.listen(PORT, () => {
    console.log(`╔═══════════════════════════════════════════════════════╗`);
    console.log(`║  copilot-openai-compatible server started             ║`);
    console.log(`║  Listening on  http://localhost:${PORT}                  ║`);
    console.log(`║  Models        http://localhost:${PORT}/v1/models        ║`);
    console.log(`║  Chat          POST http://localhost:${PORT}/v1/chat/completions ║`);
    console.log(`╚═══════════════════════════════════════════════════════╝`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[server] Received ${signal}, shutting down…`);
    sessionManager.destroy();
    server.close(async () => {
      await stopCopilotClient();
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown takes too long
    setTimeout(() => {
      console.error("[server] Forced exit after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
