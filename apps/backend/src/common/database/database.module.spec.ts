import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QueueService } from '@/common/queue/queue.service.js';

import type { Database } from '@workspace/database/client';

describe('database module', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('makes the configured Drizzle client available to the application', async () => {
    vi.stubEnv('POSTGRES_HOST', 'localhost');
    vi.stubEnv('POSTGRES_PORT', '5432');
    vi.stubEnv('POSTGRES_USER', 'test');
    vi.stubEnv('POSTGRES_PASSWORD', 'test');
    vi.stubEnv('DATABASE_NAME', 'test');
    vi.stubEnv('postgres__pool__max', '8');
    vi.stubEnv('postgres__pool__min', '1');
    vi.stubEnv('logger__level', 'silent');

    const { AppModule } = await import('@/api/api.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(QueueService)
      .useValue({})
      .compile();
    await module.init();

    const db = module.get<Database>(getDrizzleToken());
    expect(db.$client.options.max).toBe(8);
    expect(db.$client.options).toMatchObject({
      database: 'test',
      host: 'localhost',
      password: 'test',
      port: 5432,
      user: 'test',
    });

    await module.close();
  });
});
