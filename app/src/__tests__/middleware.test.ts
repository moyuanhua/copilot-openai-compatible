import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { CopilotService } from '../copilot/copilot.service';

describe('Auth middleware', () => {
  const OLD_ENV = process.env;

  async function createTestApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CopilotService)
      .useValue({
        getClient: () => ({}),
      })
      .compile();

    const app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    return app;
  }

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    delete process.env.PROXY_API_KEY;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns 200 /health without auth key set', async () => {
    const app = await createTestApp();
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    await app.close();
  });

  it('returns 401 when PROXY_API_KEY is set and no token supplied', async () => {
    process.env.PROXY_API_KEY = 'secret-key';
    const app = await createTestApp();
    const res = await request(app.getHttpServer()).get('/v1/models');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_api_key');
    await app.close();
  });

  it('returns 200 with correct Bearer token', async () => {
    process.env.PROXY_API_KEY = 'secret-key';
    const app = await createTestApp();
    const res = await request(app.getHttpServer())
      .get('/v1/models')
      .set('Authorization', 'Bearer secret-key');
    expect(res.status).toBe(200);
    await app.close();
  });

  it('returns 401 with incorrect Bearer token', async () => {
    process.env.PROXY_API_KEY = 'secret-key';
    const app = await createTestApp();
    const res = await request(app.getHttpServer())
      .get('/v1/models')
      .set('Authorization', 'Bearer wrong-key');
    expect(res.status).toBe(401);
    await app.close();
  });
});
