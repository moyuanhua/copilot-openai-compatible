import type { CopilotClient, CopilotSession, SessionConfig } from "@github/copilot-sdk";
import { approveAll } from "./client.js";

interface SessionEntry {
  session: CopilotSession;
  lastUsed: number;
  model: string;
}

/**
 * Manages long-lived Copilot sessions keyed by an arbitrary session ID string.
 * Idle sessions are automatically disconnected after `ttlMs` milliseconds.
 *
 * Session ID comes from the `X-Session-Id` request header.
 * Requests without that header get an ephemeral session (not stored here).
 */
export class SessionManager {
  private sessions = new Map<string, SessionEntry>();
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly client: CopilotClient,
    private readonly ttlMs = 10 * 60 * 1000,
  ) {
    this.timer = setInterval(() => this.evictIdle(), 60_000);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  /**
   * Returns existing session for `sessionId` (if provided and found),
   * or creates a fresh one.
   * When `sessionId` is undefined an ephemeral session is returned — not stored.
   */
  async getOrCreate(
    sessionId: string | undefined,
    opts: {
      model: string;
      systemContent?: string;
      tools?: SessionConfig["tools"];
    },
  ): Promise<{ session: CopilotSession; isNew: boolean }> {
    if (sessionId) {
      const entry = this.sessions.get(sessionId);
      if (entry) {
        entry.lastUsed = Date.now();
        return { session: entry.session, isNew: false };
      }
    }

    const cfg: SessionConfig = {
      model: opts.model,
      onPermissionRequest: approveAll,
      streaming: true,
    };

    if (opts.systemContent) {
      (cfg as any).systemMessage = { mode: "customize", content: opts.systemContent, sections: {} };
    }

    if (opts.tools && opts.tools.length > 0) cfg.tools = opts.tools;

    const session = await this.client.createSession(cfg);

    if (sessionId) {
      this.sessions.set(sessionId, { session, lastUsed: Date.now(), model: opts.model });
      console.log(`[session] Created session "${sessionId}" (model: ${opts.model})`);
    }

    return { session, isNew: true };
  }

  /** Disconnect and remove a session by ID. */
  async remove(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    this.sessions.delete(sessionId);
    try {
      await entry.session.disconnect();
      console.log(`[session] Removed "${sessionId}"`);
    } catch (err) {
      console.warn(`[session] Error disconnecting "${sessionId}":`, err);
    }
  }

  /** Stop the TTL cleanup interval. */
  destroy(): void {
    clearInterval(this.timer);
  }

  private evictIdle(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now - entry.lastUsed > this.ttlMs) {
        console.log(`[session] Evicting idle session "${id}"`);
        this.sessions.delete(id);
        entry.session.disconnect().catch((err: unknown) => {
          console.warn(`[session] Error evicting "${id}":`, err);
        });
      }
    }
  }
}
