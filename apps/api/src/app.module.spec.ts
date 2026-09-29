import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module.js';

import type { INestApplication } from '@nestjs/common';

const ADA = { email: 'ada@example.com', password: 'ada-password-123' };
const GRACE = { email: 'grace@example.com', password: 'grace-password-123' };

const login = async (
  app: INestApplication,
  credentials: { email: string; password: string },
): Promise<string> => {
  const response = await request(app.getHttpServer()).post('/auth/login').send(credentials);
  return response.body.data.accessToken;
};

describe('response envelope', () => {
  let app: INestApplication;
  let authorization: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    authorization = `Bearer ${await login(app, ADA)}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps success in { ok: true, data }', async () => {
    const response = await request(app.getHttpServer())
      .get('/greeting?name=Ada')
      .set('Authorization', authorization);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { message: 'Hello, Ada!' }, ok: true });
  });

  it('wraps a domain failure in { ok: false, error }', async () => {
    const response = await request(app.getHttpServer())
      .get('/greeting?name=')
      .set('Authorization', authorization);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'GreetingNameEmptyError', message: 'Please enter a name.' },
      ok: false,
    });
  });

  it('rejects a query that fails its zod DTO with VALIDATION_FAILED', async () => {
    const response = await request(app.getHttpServer())
      .get('/greeting?name=a&name=b')
      .set('Authorization', authorization);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' }, ok: false });
    expect(response.body.error.message).toContain('name');
  });

  it('assigns a unique request id to every response', async () => {
    const first = await request(app.getHttpServer())
      .get('/greeting')
      .set('Authorization', authorization);
    const second = await request(app.getHttpServer())
      .get('/greeting')
      .set('Authorization', authorization);
    const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;
    expect(first.headers['x-request-id']).toMatch(uuid);
    expect(second.headers['x-request-id']).toMatch(uuid);
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('ignores a client-supplied request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/greeting')
      .set('Authorization', authorization)
      .set('X-Request-Id', 'evil');
    expect(response.headers['x-request-id']).not.toBe('evil');
  });

  it('wraps an unknown route in { ok: false, error }', async () => {
    const response = await request(app.getHttpServer())
      .get('/nope')
      .set('Authorization', authorization);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' }, ok: false });
  });
});

describe('auth', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with valid credentials and returns a bearer token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'ada-password-123' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { accessToken: expect.any(String), expiresIn: 3600, tokenType: 'Bearer' },
      ok: true,
    });
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'nope' });
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'nope' });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      error: { code: 'InvalidCredentialsError', message: 'Email or password is incorrect.' },
      ok: false,
    });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it.each([
    {},
    { email: 'not-an-email', password: 'x' },
    { email: 'ada@example.com', password: '' },
  ])('rejects the login body %o with VALIDATION_FAILED', async (body) => {
    const response = await request(app.getHttpServer()).post('/auth/login').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' }, ok: false });
  });

  it('returns the logged-in user from /auth/me', async () => {
    const token = await login(app, ADA);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { email: 'ada@example.com', id: 'user-1' }, ok: true });
  });

  it('keeps the current user isolated between concurrent requests', async () => {
    const adaToken = await login(app, ADA);
    const graceToken = await login(app, GRACE);

    const [ada, grace] = await Promise.all(
      [adaToken, graceToken].map((token) =>
        request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`),
      ),
    );

    expect(ada?.body).toEqual({ data: { email: 'ada@example.com', id: 'user-1' }, ok: true });
    expect(grace?.body).toEqual({ data: { email: 'grace@example.com', id: 'user-2' }, ok: true });
  });

  it.each(['/health', '/greeting', '/auth/me'])(
    'returns 401 for %s without a token',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' }, ok: false });
    },
  );

  it('protects /health with a token and serves it when valid', async () => {
    const token = await login(app, ADA);

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  describe('rejects a bad token with 401 UNAUTHORIZED', () => {
    const payload = { email: 'ada@example.com', sub: 'user-1' };

    it.each(['Bearer', 'Bearer not.a.jwt', 'Token abc'])('for the header %o', async (header) => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', header);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' }, ok: false });
    });

    it('for a token signed with another secret', async () => {
      const forged = await new JwtService({ secret: 'x'.repeat(40) }).signAsync(payload);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${forged}`);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' }, ok: false });
    });

    it('for an expired token', async () => {
      const expired = await jwtService.signAsync(payload, { expiresIn: -1 });

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${expired}`);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' }, ok: false });
    });
  });
});
