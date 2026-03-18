/**
 * Configuration management — reads environment variables and exposes typed config.
 */

export interface Config {
  /** Port for the proxy server */
  port: number;
  /** API key clients must provide to call the proxy (Bearer token) */
  proxyApiKey: string;
  /** GitHub token used for server-side Copilot authentication (GITHUB_TOKEN or GH_TOKEN) */
  githubToken: string | undefined;
  /** When true, clients may supply their own GitHub token via X-GitHub-Token header */
  enablePassthrough: boolean;
  /** Log level */
  logLevel: "none" | "error" | "warning" | "info" | "debug";
  /** Rate-limit: max requests per windowMs per key */
  rateLimitMax: number;
  /** Rate-limit: window duration in milliseconds */
  rateLimitWindowMs: number;
  /** Default model to use when none is specified */
  defaultModel: string;
}

function parseLogLevel(raw: string | undefined): Config["logLevel"] {
  const valid = ["none", "error", "warning", "info", "debug"] as const;
  if (raw && (valid as readonly string[]).includes(raw)) {
    return raw as Config["logLevel"];
  }
  return "info";
}

export function loadConfig(): Config {
  const proxyApiKey = process.env["PROXY_API_KEY"] ?? "";
  if (!proxyApiKey) {
    console.warn(
      "[config] PROXY_API_KEY is not set — the proxy will reject all requests. " +
        "Set PROXY_API_KEY to a secret token.",
    );
  }

  return {
    port: parseInt(process.env["PORT"] ?? "3000", 10),
    proxyApiKey,
    githubToken: process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"],
    enablePassthrough: process.env["ENABLE_PASSTHROUGH"] === "true",
    logLevel: parseLogLevel(process.env["LOG_LEVEL"]),
    rateLimitMax: parseInt(process.env["RATE_LIMIT_MAX"] ?? "60", 10),
    rateLimitWindowMs: parseInt(process.env["RATE_LIMIT_WINDOW_MS"] ?? "60000", 10),
    defaultModel: process.env["DEFAULT_MODEL"] ?? "gpt-4.1",
  };
}
