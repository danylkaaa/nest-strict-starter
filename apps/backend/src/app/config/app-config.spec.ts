import { describe, expect, it } from 'vitest';

import { AppConfigSchema } from '@/app/config/app-config.js';

const DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars';

describe('app config schema', () => {
  it('applies defaults when only required settings are provided and leaves LOG_LEVEL unset', () => {
    const config = AppConfigSchema.parse({ DATABASE_URL, JWT_SECRET });

    expect(config).toEqual({
      DATABASE_TIMEOUT_MS: 3000,
      DATABASE_URL,
      JWT_EXPIRES_IN: 3600,
      JWT_SECRET,
      NODE_ENV: 'development',
      PORT: 3000,
    });
    expect(config.LOG_LEVEL).toBeUndefined();
  });

  it('keeps the env variable names and coerces the port to a number', () => {
    const config = AppConfigSchema.parse({
      DATABASE_TIMEOUT_MS: 3000,
      DATABASE_URL,
      JWT_EXPIRES_IN: '60',
      JWT_SECRET,
      LOG_LEVEL: 'warn',
      NODE_ENV: 'production',
      PORT: '8080',
    });

    expect(config).toEqual({
      DATABASE_TIMEOUT_MS: 3000,
      DATABASE_URL,
      JWT_EXPIRES_IN: 60,
      JWT_SECRET,
      LOG_LEVEL: 'warn',
      NODE_ENV: 'production',
      PORT: 8080,
    });
  });

  it('ignores unrelated environment variables', () => {
    expect(AppConfigSchema.parse({ DATABASE_URL, HOME: '/root', JWT_SECRET })).not.toHaveProperty(
      'HOME',
    );
  });

  it.each(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])(
    'accepts LOG_LEVEL %s',
    (level) => {
      expect(AppConfigSchema.parse({ DATABASE_URL, JWT_SECRET, LOG_LEVEL: level }).LOG_LEVEL).toBe(
        level,
      );
    },
  );

  it.each([
    { DATABASE_TIMEOUT_MS: '0', DATABASE_URL, JWT_SECRET },
    { DATABASE_TIMEOUT_MS: 'invalid', DATABASE_URL, JWT_SECRET },
    { DATABASE_URL, JWT_SECRET, PORT: 'abc' },
    { DATABASE_URL, JWT_SECRET, PORT: '70000' },
    { DATABASE_URL, JWT_SECRET, LOG_LEVEL: 'loud' },
    { DATABASE_URL, JWT_SECRET, NODE_ENV: 'staging' },
    { DATABASE_URL, JWT_EXPIRES_IN: '0', JWT_SECRET },
    { DATABASE_URL, JWT_EXPIRES_IN: '1h', JWT_SECRET },
  ])('rejects invalid input %o', (env) => {
    expect(AppConfigSchema.safeParse(env).success).toBe(false);
  });

  it.each([undefined, '', 'not-a-url', 'https://example.com'])(
    'rejects invalid DATABASE_URL %s',
    (databaseUrl) => {
      expect(AppConfigSchema.safeParse({ DATABASE_URL: databaseUrl, JWT_SECRET }).success).toBe(
        false,
      );
    },
  );

  it('rejects a missing JWT_SECRET', () => {
    expect(AppConfigSchema.safeParse({ DATABASE_URL }).success).toBe(false);
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(AppConfigSchema.safeParse({ DATABASE_URL, JWT_SECRET: 'short' }).success).toBe(false);
  });
});
