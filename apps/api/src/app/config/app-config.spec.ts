import { describe, expect, it } from 'vitest';

import { AppConfigSchema } from '@/app/config/app-config.js';

describe('app config schema', () => {
  it('applies defaults for an empty environment and leaves LOG_LEVEL unset', () => {
    const config = AppConfigSchema.parse({});

    expect(config).toEqual({ NODE_ENV: 'development', PORT: 3000 });
    expect(config.LOG_LEVEL).toBeUndefined();
  });

  it('keeps the env variable names and coerces the port to a number', () => {
    const config = AppConfigSchema.parse({
      LOG_LEVEL: 'warn',
      NODE_ENV: 'production',
      PORT: '8080',
    });

    expect(config).toEqual({ LOG_LEVEL: 'warn', NODE_ENV: 'production', PORT: 8080 });
  });

  it('ignores unrelated environment variables', () => {
    expect(AppConfigSchema.parse({ HOME: '/root' })).not.toHaveProperty('HOME');
  });

  it.each(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])(
    'accepts LOG_LEVEL %s',
    (level) => {
      expect(AppConfigSchema.parse({ LOG_LEVEL: level }).LOG_LEVEL).toBe(level);
    },
  );

  it.each([{ PORT: 'abc' }, { PORT: '70000' }, { LOG_LEVEL: 'loud' }, { NODE_ENV: 'staging' }])(
    'rejects invalid input %o',
    (env) => {
      expect(AppConfigSchema.safeParse(env).success).toBe(false);
    },
  );
});
