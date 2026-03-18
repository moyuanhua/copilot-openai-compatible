/**
 * GET /v1/models
 *
 * Returns the list of models available through the proxy.
 * Attempts to fetch the live list from the Copilot SDK and falls back to the
 * static SUPPORTED_MODELS list when the SDK is unavailable.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import type { Config } from "../config.js";
import { listCopilotModels } from "../copilot/client.js";
import { SUPPORTED_MODELS } from "../types/models.js";
import type { ModelsResponse } from "../types/openai.js";

const EPOCH = Math.floor(Date.UTC(2024, 0, 1) / 1000);

function buildModelObject(id: string) {
  return {
    id,
    object: "model" as const,
    created: EPOCH,
    owned_by: "github-copilot",
  };
}

export function createModelsRouter(config: Config): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response): Promise<void> => {
    let modelIds: string[] = SUPPORTED_MODELS;

    try {
      const liveModels = await listCopilotModels(config);
      if (liveModels.length > 0) {
        modelIds = liveModels.map((m) => m.id);
      }
    } catch {
      // Fall back to static list when SDK is not available (e.g. no CLI)
    }

    const response: ModelsResponse = {
      object: "list",
      data: modelIds.map(buildModelObject),
    };

    res.json(response);
  });

  return router;
}
