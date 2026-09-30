import { createMock } from '@golevelup/ts-vitest';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { errAsync, okAsync } from 'neverthrow';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module.js';
import { USER_REPOSITORY } from '@/modules/auth/application/ports/user-repository.port.js';
import { POSTGRES_HEALTH_PROBE } from '@/modules/health/application/ports/postgres-health-probe.port.js';
import { PostgresUnavailableError } from '@/modules/health/domain/health.errors.js';

import type { UserRepository } from '@/modules/auth/application/ports/user-repository.port.js';
import type { UserLookupError } from '@/modules/auth/domain/auth.errors.js';
import type { User } from '@/modules/auth/domain/user.js';
import type { PostgresHealthProbePort } from '@/modules/health/application/ports/postgres-health-probe.port.js';
import type { INestApplication } from '@nestjs/common';

const ADA = { email: 'ada@example.com', password: 'ada-password-123' };
const GRACE = { email: 'grace@example.com', password: 'grace-password-123' };

const TEST_USERS: readonly User[] = [
  {
    email: 'ada@example.com',
    id: 'user-1',
    passwordHash:
      'scrypt$b31dfe18191f124716c3f5622bbbdcbd$78e422eba2cc8a736338e7e4a2da66d13e9dddb460c4aec71f85f610ce825c043bade112ea394eed18af925020dc199699e44d13d7967b1a259746c02974e712',
  },
  {
    email: 'grace@example.com',
    id: 'user-2',
    passwordHash:
      'scrypt$e7e0d8c575246bebf437ecd1dfd6427a$7070cf817a797aa0f4ad070bd1b751e4a9cb70f73513f7e6038000209f86dbef50a296c283e8d79b6348ed487dc18a737453e0f5ce81bbfe276b54916e5c5e6e',
  },
];

const createUserRepository = () =>
  createMock<UserRepository>({
    findByEmail: (email) =>
      okAsync<User | null, UserLookupError>(
        TEST_USERS.find((user) => user.email === email.trim().toLowerCase()) ?? null,
      ),
  });

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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY)
      .useValue(createUserRepository())
      .compile();
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
  const probe: PostgresHealthProbePort = createMock<PostgresHealthProbePort>({
    check: () => okAsync<true, PostgresUnavailableError>(true),
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY)
      .useValue(createUserRepository())
      .overrideProvider(POSTGRES_HEALTH_PROBE)
      .useValue(probe)
      .compile();
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
    expect(response.body).toEqual({ data: { postgres: 'up', status: 'ok' }, ok: true });
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    const failure = new PostgresUnavailableError();
    probe.check = () => errAsync<true, PostgresUnavailableError>(failure);
    const token = await login(app, ADA);

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Authorization', `Bearer ${token}`);
    probe.check = () => okAsync<true, PostgresUnavailableError>(true);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: { code: failure.name, message: failure.message },
      ok: false,
    });
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
