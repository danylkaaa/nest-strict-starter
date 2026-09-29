import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module.js';

import type { INestApplication } from '@nestjs/common';

describe('get /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 in the API response envelope', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'ada-password-123' });

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' }, ok: true });
  });
});
