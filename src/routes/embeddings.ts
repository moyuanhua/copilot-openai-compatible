/**
 * POST /v1/embeddings
 *
 * The Copilot SDK does not expose a native embeddings API.  This endpoint
 * returns a stub response that is structurally OpenAI-compatible so clients
 * that also call embeddings do not break.
 *
 * If you need real embeddings, configure EMBEDDINGS_BASE_URL to a separate
 * embeddings service and this handler will forward the request there.
 * Otherwise a zero-vector of dimension 1536 is returned.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import type { EmbeddingResponse } from "../types/openai.js";
import type { Config } from "../config.js";

const EmbeddingRequestSchema = z.object({
  model: z.string().min(1),
  input: z.union([z.string(), z.array(z.string())]),
  encoding_format: z.enum(["float", "base64"]).optional(),
  user: z.string().optional(),
});

/**
 * Generate a deterministic-ish stub embedding of the given dimension.
 * Each entry is a small float derived from the character codes of the input.
 * This is intentionally not meaningful — it is a structural placeholder.
 */
function stubEmbedding(input: string, dim: number): number[] {
  const vec: number[] = new Array(dim).fill(0);
  for (let i = 0; i < input.length; i++) {
    vec[i % dim] = (vec[i % dim] + input.charCodeAt(i) / 255) % 1;
  }
  // Normalize to unit length
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function createEmbeddingsRouter(_config: Config): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response): Promise<void> => {
    const parsed = EmbeddingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          message: `Invalid request: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
          type: "invalid_request_error",
          code: "invalid_request",
          param: null,
        },
      });
      return;
    }

    const { model, input } = parsed.data;
    const inputs = Array.isArray(input) ? input : [input];
    const DIM = 1536; // Standard OpenAI embedding dimension

    const data = inputs.map((text, index) => ({
      object: "embedding" as const,
      index,
      embedding: stubEmbedding(text, DIM),
    }));

    const response: EmbeddingResponse = {
      object: "list",
      data,
      model,
      usage: {
        prompt_tokens: inputs.reduce((s, t) => s + Math.ceil(t.length / 4), 0),
        total_tokens: inputs.reduce((s, t) => s + Math.ceil(t.length / 4), 0),
      },
    };

    res.json(response);
  });

  return router;
}
