import type { CopilotClient, CopilotSession, SessionConfig } from "@github/copilot-sdk";
import { approveAll } from "./client.js";

interface SessionEntry {
  session: CopilotSession;
  lastUsed: Date;
  model: string;
}

/**
 * Manages long-lived Copilot sessions keyed by an arbitrary session ID string.
 * Idle sessions are automatically disconnected after `ttlMs` milliseconds.
 *
 * Lifecycle:
 *  - `getOrCreate(id, ...)` — returns an existing session or creates a new one.
 *  - `remove(id)`           — disconnects and removes a session immediately.
 *  - `destroy()`            — stops the cleanup timer (call on server shutdown).
 */
export class SessionManager {
  private sessions = new Map<string, SessionEntry>();
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly client: CopilotClient,
    ttlMs = 10 * 60 * 1000, // 10 minutes default
  ) {
    this.timer = setInterval(() => this.evictIdle(ttlMs), 60_000);
    // Do not block process exit for the timer.
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  /**
   * Returns existing session for `sessionId` (if provided and found),
   * or creates a fresh one.
   *
   * When `sessionId` is undefined an ephemeral session is NOT stored —
   * the caller is responsible for calling `session.disconnect()`.
   */
  async getOrCreate(
    sessionId: string | undefined,
    opts: {
      model: string;
      systemContent?: string;
      tools?: SessionConfig["tools"];
      streaming?: boolean;
    },
  ): Promise<{ session: CopilotSession; isNew: boolean }> {
    if (sessionId) {
      const entry = this.sessions.get(sessionId);
      if (entry) {
        entry.lastUsed = new Date();
        return { session: entry.session, isNew: false };
      }
    }

    const sessionConfig: SessionConfig = {
      model: opts.model,
      onPermissionRequest: approveAll,
      streaming: opts.streaming ?? true,
    };

    if (opts.systemContent) {
      sessionConfig.systemMessage = {
        mode: "customize",
        sections: {
          // Replace default identity/persona but keep safety + tool instructions
        },
        content: opts.systemContent,
      };
    }

    if (opts.tools && opts.tools.length > 0) {
      sessionConfig.tools = opts.tools;
    }

    const session = await this.client.createSession(sessionConfig);
    console.log(`[session] Created ${session.sessionId} (model: ${opts.model})`);

    if (sessionId) {
      this.sessions.set(sessionId, { session, lastUsed: new Date(), model: opts.model });
    }

    return { session, isNew: true };
  }

  /**
   * Disconnect and remove a session by ID.
   */
  async remove(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    this.sessions.delete(sessionId);
    try {
      await entry.session.disconnect();
      console.log(`[session] Removed ${sessionId}`);
    } catch (err) {
      console.warn(`[session] Error disconnecting ${sessionId}:`, err);
    }
  }

  /**
   * Stop the TTL cleanup interval.
   */
  destroy(): void {
    clearInterval(this.timer);
  }

  // ── private ──────────────────────────────────────────────────────────────────

  private evictIdle(ttlMs: number): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now - entry.lastUsed.getTime() > ttlMs) {
        console.log(`[session] Evicting idle session ${id}`);
        this.sessions.delete(id);
        entry.session.disconnect().catch((err: unknown) => {
          console.warn(`[session] Error evicting ${id}:`, err);
        });
      }
    }
  }
}
