import { randomUUID } from 'node:crypto';

import { TransactionHost } from '@nestjs-cls/transactional';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { users } from '@workspace/database/schema';
import { eq } from 'drizzle-orm';
import { ClsService } from 'nestjs-cls';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfig } from '@/app/config/app-config.js';
import { ConfigModule } from '@/app/config/config.module.js';
import { RequestContextModule } from '@/app/context/request-context.module.js';
import { DatabaseModule } from '@/app/database/database.module.js';
import { AppLoggerModule } from '@/app/logger/logger.module.js';

import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import type { TestingModule } from '@nestjs/testing';
import type { Database } from '@workspace/database/client';

describe('database transactions', () => {
  let app: TestingModule;
  let database: Database;
  let cls: ClsService;
  let host: TransactionHost<TransactionalAdapterDrizzleOrm<Database>>;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, RequestContextModule, AppLoggerModule],
    }).compile();
    await app.init();
    database = app.get<Database>(getDrizzleToken());
    cls = app.get(ClsService);
    host = app.get(TransactionHost);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reconnects after PostgreSQL terminates an idle pooled connection', async () => {
    const pool = database.$client;
    const before = await pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const idleError = new Promise<Error>((resolve) => {
      pool.once('error', resolve);
    });
    const admin = new Client({ connectionString: app.get(AppConfig).DATABASE_URL });
    await admin.connect();

    try {
      await admin.query('SELECT pg_terminate_backend($1)', [before.rows[0]?.pid]);
      await expect(idleError).resolves.toMatchObject({ code: '57P01' });
      const after = await pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');

      expect(after.rows).toHaveLength(1);
      expect(after.rows[0]?.pid).not.toBe(before.rows[0]?.pid);
    } finally {
      await admin.end();
    }
  });

  it('commits an inserted user through the CLS transaction and exposes typed queries', async () => {
    const email = `${randomUUID()}@example.com`;
    await cls.run(() =>
      host.withTransaction(async () => {
        await host.tx.insert(users).values({ email, passwordHash: 'test-hash' });
        expect(host.isTransactionActive()).toBe(true);
      }),
    );

    const user = await database.query.users.findFirst({ where: eq(users.email, email) });
    await database.delete(users).where(eq(users.email, email));

    expect(user?.email).toBe(email);
    expect(user?.passwordHash).toBe('test-hash');
    expect(user?.id).toMatch(/^usr_[0-7][0-9A-HJKMNP-TV-Z]{25}$/u);
    expect(user?.createdAt).toBeInstanceOf(Date);
    expect(user?.updatedAt).toBeInstanceOf(Date);
    expect(host.isTransactionActive()).toBe(false);
  });

  it('rolls back writes when the transaction callback rejects', async () => {
    const email = `${randomUUID()}@example.com`;

    await expect(
      cls.run(() =>
        host.withTransaction(async () => {
          await host.tx.insert(users).values({ email, passwordHash: 'test-hash' });
          throw new Error('abort transaction');
        }),
      ),
    ).rejects.toThrow('abort transaction');

    expect(await database.query.users.findFirst({ where: eq(users.email, email) })).toBeUndefined();
  });

  it('shares the transaction in nested calls and rolls them back together', async () => {
    const email = `${randomUUID()}@example.com`;

    await expect(
      cls.run(() =>
        host.withTransaction(async () => {
          await host.withTransaction(async () => {
            await host.tx.insert(users).values({ email, passwordHash: 'test-hash' });
          });
          throw new Error('abort outer transaction');
        }),
      ),
    ).rejects.toThrow('abort outer transaction');

    expect(await database.query.users.findFirst({ where: eq(users.email, email) })).toBeUndefined();
  });
  it('closes the pool through the NestJS Drizzle module on shutdown', async () => {
    await app.close();

    expect(database.$client.ended).toBe(true);
  });
});
