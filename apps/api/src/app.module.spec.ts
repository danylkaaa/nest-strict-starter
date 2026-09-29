import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module.js';

import type { INestApplication } from '@nestjs/common';

describe('response envelope', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps success in { ok: true, data }', async () => {
    const response = await request(app.getHttpServer()).get('/greeting?name=Ada');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { message: 'Hello, Ada!' }, ok: true });
  });

  it('wraps a domain failure in { ok: false, error }', async () => {
    const response = await request(app.getHttpServer()).get('/greeting?name=');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'GreetingNameEmptyError', message: 'Please enter a name.' },
      ok: false,
    });
  });

  it('rejects a query that fails its zod DTO with VALIDATION_FAILED', async () => {
    const response = await request(app.getHttpServer()).get('/greeting?name=a&name=b');
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' }, ok: false });
    expect(response.body.error.message).toContain('name');
  });

  it('assigns a unique request id to every response', async () => {
    const first = await request(app.getHttpServer()).get('/greeting');
    const second = await request(app.getHttpServer()).get('/greeting');
    const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;
    expect(first.headers['x-request-id']).toMatch(uuid);
    expect(second.headers['x-request-id']).toMatch(uuid);
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('ignores a client-supplied request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/greeting')
      .set('X-Request-Id', 'evil');
    expect(response.headers['x-request-id']).not.toBe('evil');
  });

  it('wraps an unknown route in { ok: false, error }', async () => {
    const response = await request(app.getHttpServer()).get('/nope');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' }, ok: false });
  });
});
