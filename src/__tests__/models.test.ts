/**
 * Tests for GET /v1/models
 */

import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('GET /v1/models', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    delete process.env.PROXY_API_KEY;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns a list of models in OpenAI format', async () => {
    const res = await request(app).get('/v1/models');
    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const model = res.body.data[0];
    expect(model.object).toBe('model');
    expect(typeof model.id).toBe('string');
    expect(typeof model.created).toBe('number');
    expect(model.owned_by).toBe('github-copilot');
  });
});
