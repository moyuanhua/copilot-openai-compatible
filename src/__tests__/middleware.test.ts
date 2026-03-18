/**
 * Tests for middleware: authentication and rate limiting.
 */

import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('Auth middleware', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    delete process.env.PROXY_API_KEY;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns 200 /health without auth key set', async () => {
    delete process.env.PROXY_API_KEY;
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('returns 401 when PROXY_API_KEY is set and no token supplied', async () => {
    process.env.PROXY_API_KEY = 'secret-key';
    const localApp = createApp();
    const res = await request(localApp).get('/v1/models');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_api_key');
  });

  it('returns 200 with correct Bearer token', async () => {
    process.env.PROXY_API_KEY = 'secret-key';
    const localApp = createApp();
    const res = await request(localApp).get('/v1/models').set('Authorization', 'Bearer secret-key');
    expect(res.status).toBe(200);
  });

  it('returns 401 with incorrect Bearer token', async () => {
    process.env.PROXY_API_KEY = 'secret-key';
    const localApp = createApp();
    const res = await request(localApp).get('/v1/models').set('Authorization', 'Bearer wrong-key');
    expect(res.status).toBe(401);
  });
});
