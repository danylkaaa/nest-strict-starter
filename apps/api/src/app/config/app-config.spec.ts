import { describe, expect, it } from 'vitest';

import { AppConfigSchema } from '@/app/config/app-config.js';

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars';

describe('app config schema', () => {
  it('applies defaults for an empty environment and leaves LOG_LEVEL unset', () => {
    const config = AppConfigSchema.parse({ JWT_SECRET });

    expect(config).toEqual({
      JWT_EXPIRES_IN: 3600,
      JWT_SECRET,
      NODE_ENV: 'development',
      PORT: 3000,
    });
    expect(config.LOG_LEVEL).toBeUndefined();
  });

  it('keeps the env variable names and coerces the port to a number', () => {
    const config = AppConfigSchema.parse({
      JWT_EXPIRES_IN: '60',
      JWT_SECRET,
      LOG_LEVEL: 'warn',
      NODE_ENV: 'production',
      PORT: '8080',
    });

    expect(config).toEqual({
      JWT_EXPIRES_IN: 60,
      JWT_SECRET,
      LOG_LEVEL: 'warn',
      NODE_ENV: 'production',
      PORT: 8080,
    });
  });

  it('ignores unrelated environment variables', () => {
    expect(AppConfigSchema.parse({ HOME: '/root', JWT_SECRET })).not.toHaveProperty('HOME');
  });

  it.each(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])(
    'accepts LOG_LEVEL %s',
    (level) => {
      expect(AppConfigSchema.parse({ JWT_SECRET, LOG_LEVEL: level }).LOG_LEVEL).toBe(level);
    },
  );

  it.each([
    { JWT_SECRET, PORT: 'abc' },
    { JWT_SECRET, PORT: '70000' },
    { JWT_SECRET, LOG_LEVEL: 'loud' },
    { JWT_SECRET, NODE_ENV: 'staging' },
    { JWT_EXPIRES_IN: '0', JWT_SECRET },
    { JWT_EXPIRES_IN: '1h', JWT_SECRET },
  ])('rejects invalid input %o', (env) => {
    expect(AppConfigSchema.safeParse(env).success).toBe(false);
  });

  it('rejects a missing JWT_SECRET', () => {
    expect(AppConfigSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(AppConfigSchema.safeParse({ JWT_SECRET: 'short' }).success).toBe(false);
  });
});
