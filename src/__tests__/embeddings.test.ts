/**
 * Tests for POST /v1/embeddings (stub endpoint)
 */

import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('POST /v1/embeddings', () => {
  beforeEach(() => {
    delete process.env.PROXY_API_KEY;
  });

  it('returns 501 not implemented', async () => {
    const res = await request(app)
      .post('/v1/embeddings')
      .send({ model: 'text-embedding-ada-002', input: 'hello' });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('embeddings_not_supported');
  });
});
