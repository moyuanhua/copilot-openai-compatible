import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { CopilotService } from '../copilot/copilot.service';

describe('POST /v1/embeddings', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CopilotService)
      .useValue({
        getClient: () => ({}),
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

  it('returns 501 not implemented', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/embeddings')
      .send({ model: 'text-embedding-ada-002', input: 'hello' });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('embeddings_not_supported');
  });
});
