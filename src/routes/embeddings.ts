/**
 * POST /v1/embeddings
 *
 * Stub endpoint – the GitHub Copilot SDK does not currently expose an
 * embeddings API.  This endpoint returns a 501 error with a clear message.
 */

import { Router, Request, Response } from 'express';
import { EmbeddingErrorResponse } from '../types';

const router = Router();

router.post('/', (_req: Request, res: Response) => {
  const body: EmbeddingErrorResponse = {
    error: {
      message:
        'The /v1/embeddings endpoint is not supported by this proxy. ' +
        'The GitHub Copilot SDK does not currently provide an embeddings API. ' +
        'This endpoint will be implemented once the SDK adds embedding support.',
      type: 'not_implemented_error',
      code: 'embeddings_not_supported',
    },
  };
  res.status(501).json(body);
});

export default router;
