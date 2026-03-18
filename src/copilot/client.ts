/**
 * Copilot SDK client singleton.
 *
 * Authentication: relies on the Copilot CLI being installed and logged in on
 * the host.  The server starts the CLI process via the SDK (useLoggedInUser
 * mode) so no credentials are ever forwarded from external callers.
 *
 * See: https://github.com/github/copilot-sdk/blob/main/README.md
 */

import { CopilotClient } from '@github/copilot-sdk';
import type { CopilotClientOptions } from '@github/copilot-sdk';

let _client: CopilotClient | null = null;
let _startPromise: Promise<CopilotClient> | null = null;

/**
 * Returns the shared CopilotClient, starting it if it has not been started yet.
 * Multiple concurrent callers will await the same startup promise.
 */
export async function getCopilotClient(): Promise<CopilotClient> {
  if (_client !== null) return _client;
  if (_startPromise !== null) return _startPromise;

  _startPromise = (async () => {
    const rawLogLevel = process.env.COPILOT_LOG_LEVEL ?? 'warning';
    const validLogLevels = ['none', 'error', 'warning', 'info', 'debug', 'all'] as const;
    type LogLevel = (typeof validLogLevels)[number];
    const logLevel: LogLevel = (validLogLevels as readonly string[]).includes(rawLogLevel)
      ? (rawLogLevel as LogLevel)
      : 'warning';

    const opts: CopilotClientOptions = {
      // useLoggedInUser is true by default; no githubToken is supplied so the
      // SDK picks up the credentials stored by `copilot auth login`.
      logLevel,
    };
    const client = new CopilotClient(opts);
    await client.start();
    _client = client;
    return client;
  })();

  return _startPromise;
}

/**
 * Gracefully stop the shared Copilot client.  Call this on process shutdown.
 */
export async function stopCopilotClient(): Promise<void> {
  if (_client) {
    await _client.stop();
    _client = null;
    _startPromise = null;
  }
}

/**
 * Returns the list of models available via the Copilot SDK.
 * Falls back to a static list when the SDK method is unavailable or fails.
 */
export const STATIC_MODELS = [
  'gpt-4.1',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4.5',
  'claude-3.5-sonnet',
  'o3-mini',
  'o1',
];
