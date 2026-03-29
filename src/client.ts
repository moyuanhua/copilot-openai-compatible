import { existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

export { approveAll };

let _client: CopilotClient | undefined;

/**
 * Resolve the Copilot CLI binary path with the following priority:
 *  1. COPILOT_CLI_PATH env var (user override)
 *  2. Bundled platform-specific binary in node_modules
 *  3. Brew-installed binary on macOS
 *  4. undefined — let the SDK try its own resolution (may fail)
 */
function resolveCLIPath(): string | undefined {
  if (process.env.COPILOT_CLI_PATH) {
    return process.env.COPILOT_CLI_PATH;
  }

  // Bundled binary installed alongside @github/copilot-sdk
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const bundledCandidates = [
    resolve(dir, "../node_modules/@github/copilot-darwin-arm64/copilot"),
    resolve(dir, "../node_modules/@github/copilot-darwin-x64/copilot"),
    resolve(dir, "../node_modules/@github/copilot-linux-x64/copilot"),
    resolve(dir, "../node_modules/@github/copilot-linux-arm64/copilot"),
    resolve(dir, "../node_modules/@github/copilot-win32-x64/copilot.exe"),
  ];
  for (const p of bundledCandidates) {
    if (existsSync(p)) {
      console.log(`[copilot] Using bundled CLI: ${p}`);
      return p;
    }
  }

  // System-installed (brew on macOS, apt on Linux, etc.)
  const systemCandidates = [
    "/opt/homebrew/bin/copilot",
    "/usr/local/bin/copilot",
    "/usr/bin/copilot",
  ];
  for (const p of systemCandidates) {
    if (existsSync(p)) {
      console.log(`[copilot] Using system CLI: ${p}`);
      return p;
    }
  }

  return undefined;
}

/**
 * Returns the shared CopilotClient singleton.
 * The client is started automatically on first call.
 */
export async function getCopilotClient(): Promise<CopilotClient> {
  if (_client) return _client;

  const cliPath = resolveCLIPath();
  if (cliPath) {
    console.log(`[copilot] CLI resolved to: ${cliPath}`);
  } else {
    console.warn("[copilot] Could not auto-detect CLI path; falling back to SDK default resolution");
  }

  _client = new CopilotClient({
    useLoggedInUser: true,
    autoStart: true,
    ...(cliPath ? { cliPath } : {}),
  });

  await _client.start();
  console.log("[copilot] Client started (using logged-in user)");
  return _client;
}

/**
 * Gracefully stop the client (call on process exit).
 */
export async function stopCopilotClient(): Promise<void> {
  if (!_client) return;
  const errors = await _client.stop();
  if (errors.length) {
    console.error("[copilot] Errors during shutdown:", errors);
  } else {
    console.log("[copilot] Client stopped");
  }
  _client = undefined;
}
