import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiConfig, parseApiConfig } from './api.config.js';

describe('parseApiConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('maps double-underscore environment keys to nested config', () => {
    const config = parseApiConfig({
      http__port: '3100',
      logger__level: 'silent',
      NODE_ENV: 'test',
      postgres__pool__max: '8',
      postgres__pool__min: '2',
      postgres__timeout_ms: '2500',
      postgres__url: 'postgresql://test:test@localhost:5432/test',
    });

    expect(config).toMatchObject({
      http: { port: 3100 },
      logger: { level: 'silent' },
      NODE_ENV: 'test',
      postgres: {
        pool: { max: 8, min: 2 },
        timeout_ms: 2500,
        url: 'postgresql://test:test@localhost:5432/test',
      },
    });
  });

  it('provides the parsed config through Nest injection', async () => {
    vi.stubEnv('postgres__url', 'postgresql://test:test@localhost:5432/test');
    vi.stubEnv('logger__level', 'silent');

    const { ConfigModule } = await import('./config.module.js');
    const module = await Test.createTestingModule({ imports: [ConfigModule] }).compile();

    expect(module.get(ApiConfig).logger).toEqual({ level: 'silent' });

    await module.close();
  });
});
