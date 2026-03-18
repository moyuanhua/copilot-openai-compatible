/**
 * GET /v1/models
 *
 * Returns available Copilot models in OpenAI-compatible format.
 * Tries to obtain the list dynamically from the Copilot SDK; falls back to a
 * static list when the SDK is unavailable (e.g. in CI without the CLI).
 */

import { Router, Request, Response } from 'express';
import { getCopilotClient, STATIC_MODELS } from '../copilot/client.js';
import { ModelObject, ModelsListResponse } from '../types.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const created = Math.floor(Date.now() / 1000);
  let modelIds: string[] = STATIC_MODELS;

  // Attempt dynamic discovery via the SDK.
  try {
    const client = await getCopilotClient();
    // The SDK exposes listModels() when the CLI is available.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (client as any).listModels === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sdkModels: any[] = await (client as any).listModels();
      if (Array.isArray(sdkModels) && sdkModels.length > 0) {
        modelIds = sdkModels.map((m) => (typeof m === 'string' ? m : (m.id ?? m.name ?? m)));
      }
    }
  } catch {
    // CLI not available – use static list
  }

  const data: ModelObject[] = modelIds.map((id) => ({
    id,
    object: 'model',
    created,
    owned_by: 'github-copilot',
  }));

  const response: ModelsListResponse = { object: 'list', data };
  res.json(response);
});

export default router;
