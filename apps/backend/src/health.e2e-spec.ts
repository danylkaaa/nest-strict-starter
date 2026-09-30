import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

describe('postgres health endpoint', () => {
  let app: INestApplication<Server>;
  let authorization: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    authorization = `Bearer ${await app.get(JwtService).signAsync({ email: 'ada@example.com', sub: 'user-1' })}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports PostgreSQL up after querying the real database', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { postgres: 'up', status: 'ok' }, ok: true });
  });
});
