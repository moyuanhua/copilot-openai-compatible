import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { CopilotService } from '../copilot/copilot.service';

describe('GET /v1/models', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CopilotService)
      .useValue({
        getClient: () => ({
          createSession: jest.fn(),
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
    delete process.env.PROXY_API_KEY;
  });

  afterEach(async () => {
    await app.close();
    delete process.env.PROXY_API_KEY;
  });

  it('returns a list of models in OpenAI format', async () => {
    const res = await request(app.getHttpServer()).get('/v1/models');
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
