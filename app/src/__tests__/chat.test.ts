import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { CopilotService } from '../copilot/copilot.service';
import { MockCopilotSession } from './__mocks__/@github/copilot-sdk';

describe('POST /v1/chat/completions', () => {
  let app: INestApplication;
  let mockSession: MockCopilotSession;

  beforeEach(async () => {
    mockSession = new MockCopilotSession();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CopilotService)
      .useValue({
        getClient: () => ({
          createSession: jest.fn().mockResolvedValue(mockSession),
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    delete process.env.PROXY_API_KEY;
  });

  afterEach(async () => {
    await app.close();
    delete process.env.PROXY_API_KEY;
  });

  it('returns 400 when messages is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .send({ model: 'gpt-4.1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when messages is empty', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .send({ model: 'gpt-4.1', messages: [] });
    expect(res.status).toBe(400);
  });

  it('returns a non-streaming chat completion', async () => {
    const res = await request(app.getHttpServer())
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
    const res = await request(app.getHttpServer())
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
    const res = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Stream test' }],
        stream: true,
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const text = res.text;
    const lines = text.split('\n').filter((l: string) => l.startsWith('data: '));
    expect(lines.length).toBeGreaterThan(0);

    const lastLine = lines[lines.length - 1];
    expect(lastLine).toBe('data: [DONE]');

    const jsonLines = lines.filter((l: string) => l !== 'data: [DONE]');
    expect(jsonLines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(jsonLines[0].replace('data: ', ''));
    expect(parsed.object).toBe('chat.completion.chunk');
    expect(Array.isArray(parsed.choices)).toBe(true);
  });
});
