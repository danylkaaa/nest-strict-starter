import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@workspace/database/client';

describe('database module', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('makes the configured Drizzle client available to the application', async () => {
    vi.stubEnv('postgres__url', 'postgresql://test:test@localhost:5432/test');
    vi.stubEnv('postgres__pool__max', '8');
    vi.stubEnv('postgres__pool__min', '1');
    vi.stubEnv('logger__level', 'silent');

    const { AppModule } = await import('@/api/api.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.init();

    const db = module.get<Database>(getDrizzleToken());
    expect(db.$client.options.max).toBe(8);

    await module.close();
  });
});
