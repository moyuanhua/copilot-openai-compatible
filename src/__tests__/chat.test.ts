/**
 * Tests for POST /v1/chat/completions
 *
 * The Copilot SDK is mocked (see __mocks__) so no CLI is needed.
 */

import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('POST /v1/chat/completions', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    delete process.env.PROXY_API_KEY;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns 400 when messages is missing', async () => {
    const res = await request(app).post('/v1/chat/completions').send({ model: 'gpt-4.1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('missing_required_param');
  });

  it('returns 400 when messages is empty', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send({ model: 'gpt-4.1', messages: [] });
    expect(res.status).toBe(400);
  });

  it('returns a non-streaming chat completion', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Say hello' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.object).toBe('chat.completion');
    expect(res.body.choices).toHaveLength(1);
    expect(res.body.choices[0].message.role).toBe('assistant');
    expect(typeof res.body.choices[0].message.content).toBe('string');
    expect(res.body.choices[0].finish_reason).toBe('stop');
    expect(res.body.usage).toBeDefined();
  });

  it('includes system message in session config', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hi' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.object).toBe('chat.completion');
  });

  it('returns SSE stream when stream=true', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Stream test' }],
        stream: true,
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    // Parse SSE events from the response text
    const text = res.text;
    const lines = text.split('\n').filter((l) => l.startsWith('data: '));
    expect(lines.length).toBeGreaterThan(0);

    // Last data line should be [DONE]
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toBe('data: [DONE]');

    // At least one JSON chunk should have the correct shape
    const jsonLines = lines.filter((l) => l !== 'data: [DONE]');
    expect(jsonLines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(jsonLines[0].replace('data: ', ''));
    expect(parsed.object).toBe('chat.completion.chunk');
    expect(Array.isArray(parsed.choices)).toBe(true);
  });
});
