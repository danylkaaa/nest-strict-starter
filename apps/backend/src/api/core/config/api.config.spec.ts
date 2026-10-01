import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiConfig, parseApiConfig } from './api.config.js';

describe('parseApiConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('maps double-underscore environment keys to nested config', () => {
    const config = parseApiConfig({
      DATABASE_NAME: 'nest_starter',
      http__port: '3100',
      logger__level: 'silent',
      NODE_ENV: 'test',
      postgres__pool__max: '8',
      postgres__pool__min: '2',
      postgres__timeout_ms: '2500',
      POSTGRES_HOST: 'db.internal',
      POSTGRES_PASSWORD: 'secret',
      POSTGRES_PORT: '5433',
      POSTGRES_USER: 'app',
    });

    expect(config).toMatchObject({
      http: { port: 3100 },
      logger: { level: 'silent' },
      NODE_ENV: 'test',
      postgres: {
        database: 'nest_starter',
        host: 'db.internal',
        password: 'secret',
        pool: { max: 8, min: 2 },
        port: 5433,
        timeout_ms: 2500,
        user: 'app',
      },
    });
  });

  it('defaults the PostgreSQL host to localhost', () => {
    const config = parseApiConfig({
      DATABASE_NAME: 'nest_starter',
      POSTGRES_PASSWORD: 'secret',
      POSTGRES_PORT: '5433',
      POSTGRES_USER: 'app',
    });

    expect(config.postgres.host).toBe('localhost');
  });

  it('treats an empty PostgreSQL host as unset', () => {
    const config = parseApiConfig({
      DATABASE_NAME: 'nest_starter',
      POSTGRES_HOST: '',
      POSTGRES_PASSWORD: 'secret',
      POSTGRES_PORT: '5433',
      POSTGRES_USER: 'app',
    });

    expect(config.postgres.host).toBe('localhost');
  });

  it('rejects a missing PostgreSQL setting', () => {
    expect(() => parseApiConfig({ DATABASE_NAME: 'nest_starter', POSTGRES_PORT: '5433' })).toThrow(
      'postgres',
    );
  });

  it('provides the parsed config through Nest injection', async () => {
    vi.stubEnv('POSTGRES_PORT', '5432');
    vi.stubEnv('logger__level', 'silent');

    const { ConfigModule } = await import('./config.module.js');
    const module = await Test.createTestingModule({ imports: [ConfigModule] }).compile();

    expect(module.get(ApiConfig).logger).toEqual({ level: 'silent' });

    await module.close();
  });
});
