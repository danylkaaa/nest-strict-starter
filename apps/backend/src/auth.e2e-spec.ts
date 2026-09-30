import { randomUUID } from 'node:crypto';

import { TransactionHost } from '@nestjs-cls/transactional';
import { getDrizzleToken } from '@nestjs/drizzle';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { users } from '@workspace/database/schema';
import { eq } from 'drizzle-orm';
import { ClsService } from 'nestjs-cls';
import { ok } from 'neverthrow';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppModule } from '@/app.module.js';
import { USER_REPOSITORY } from '@/modules/auth/application/ports/user-repository.port.js';
import { LoginResponseSchema } from '@/modules/auth/presentation/dtos/login-response.dto.js';

import type { UserRepository } from '@/modules/auth/application/ports/user-repository.port.js';
import type { User } from '@/modules/auth/domain/user.js';
import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '@workspace/database/client';
import type { Server } from 'node:http';

const loginEnvelope = z.object({ data: LoginResponseSchema, ok: z.literal(true) });

describe('database login', () => {
  let app: INestApplication<Server>;
  let database: Database;
  let seededUser: User;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    database = app.get<Database>(getDrizzleToken());
    seededUser = z
      .object({ email: z.string(), id: z.string(), passwordHash: z.string() })
      .parse(await database.query.users.findFirst({ where: eq(users.email, 'admin@example.com') }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in the seeded account and uses its database identity in JWT and me', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ADMIN@example.com', password: '12345678' });
    const token = loginEnvelope.parse(response.body).data.accessToken;
    const claims = await app.get(JwtService).verifyAsync<{ email: string; sub: string }>(token);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(claims.sub).toBe(seededUser.id);
    expect(claims.sub).toMatch(/^usr_[0-7][0-9A-HJKMNP-TV-Z]{25}$/u);
    expect(claims.email).toBe(seededUser.email);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ data: { email: seededUser.email, id: seededUser.id }, ok: true });
    expect(response.text).not.toContain(seededUser.passwordHash);
  });

  it.each([
    { email: 'admin@example.com', password: 'wrong-password' },
    { email: 'unknown-login-test@example.com', password: '12345678' },
    { email: 'ada@example.com', password: 'ada-password-123' },
  ])('rejects credentials absent from the database %o', async (credentials) => {
    const response = await request(app.getHttpServer()).post('/auth/login').send(credentials);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'InvalidCredentialsError', message: 'Email or password is incorrect.' },
      ok: false,
    });
  });

  it('authenticates a newly stored user without any hardcoded account mapping', async () => {
    const email = `${randomUUID()}@example.com`;
    const inserted = await database
      .insert(users)
      .values({ email, passwordHash: seededUser.passwordHash })
      .returning({ id: users.id });

    try {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: '12345678' });
      const token = loginEnvelope.parse(response.body).data.accessToken;
      const claims = await app.get(JwtService).verifyAsync<{ email: string; sub: string }>(token);

      expect(response.status).toBe(200);
      expect(claims).toMatchObject({ email, sub: inserted[0]?.id });
    } finally {
      await database.delete(users).where(eq(users.email, email));
    }
  });

  it('reads uncommitted users through the active CLS transaction', async () => {
    const email = `${randomUUID()}@example.com`;
    const host =
      app.get<TransactionHost<TransactionalAdapterDrizzleOrm<Database>>>(TransactionHost);
    const repository = app.get<UserRepository>(USER_REPOSITORY);

    await expect(
      app.get(ClsService).run(() =>
        host.withTransaction(async () => {
          const inserted = await host.tx
            .insert(users)
            .values({ email, passwordHash: seededUser.passwordHash })
            .returning({ email: users.email, id: users.id, passwordHash: users.passwordHash });
          expect(await repository.findByEmail(email)).toEqual(ok(inserted[0]));
          expect(
            await database.query.users.findFirst({ where: eq(users.email, email) }),
          ).toBeUndefined();
          throw new Error('roll back test user');
        }),
      ),
    ).rejects.toThrow('roll back test user');

    expect(await repository.findByEmail(email)).toEqual(ok(null));
  });
});
