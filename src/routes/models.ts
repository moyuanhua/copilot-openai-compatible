import { Router } from "express";
import { COPILOT_MODELS } from "../types.js";
import type { ModelsListResponse } from "../types.js";

export const modelsRouter = Router();

/**
 * GET /v1/models
 *
 * Returns the list of models available through GitHub Copilot in the standard
 * OpenAI format.
 */
modelsRouter.get("/", (_req, res) => {
  const response: ModelsListResponse = {
    object: "list",
    data: COPILOT_MODELS,
  };
  res.json(response);
});
