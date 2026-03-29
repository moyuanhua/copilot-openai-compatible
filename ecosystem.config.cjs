module.exports = {
  apps: [
    {
      name: "copilot-api",
      script: "dist/server.js",
      interpreter: "node",

      // ── Instances & mode ────────────────────────────────────────────────────
      // Single instance — the Copilot SDK manages one shared client internally.
      instances: 1,
      exec_mode: "fork",

      // ── Environment ─────────────────────────────────────────────────────────
      env: {
        NODE_ENV: "production",
        PORT: 8888,
        SESSION_TTL_MS: 600000,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 3000,
        SESSION_TTL_MS: 600000,
      },

      // ── Logging ─────────────────────────────────────────────────────────────
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // ── Restart policy ──────────────────────────────────────────────────────
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 2000,

      // ── Graceful shutdown ───────────────────────────────────────────────────
      kill_timeout: 10000,    // wait up to 10 s for SIGTERM handler
      listen_timeout: 15000,  // wait up to 15 s for app to be ready
    },
  ],
};
