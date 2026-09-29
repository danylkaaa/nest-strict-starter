import { pino } from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';

import { createLoggerConfig, FILTERED_LOG_CONTEXTS } from '@/app/logger/logger.config.js';

import type { AppConfig } from '@/app/config/app-config.js';

const options = (config: Partial<Pick<AppConfig, 'LOG_LEVEL' | 'NODE_ENV'>> = {}) =>
  createLoggerConfig({ NODE_ENV: 'production', ...config }).pinoHttp;

describe('logger config', () => {
  let lines: string[];
  const stream = { write: (line: string) => lines.push(line) };

  const build = (config?: Partial<Pick<AppConfig, 'LOG_LEVEL' | 'NODE_ENV'>>) => {
    const { hooks } = options(config);
    return pino({ hooks, level: 'trace' }, stream);
  };

  beforeEach(() => {
    lines = [];
  });

  describe('log level', () => {
    it.each([
      ['production', 'info'],
      ['test', 'warn'],
      ['development', 'debug'],
    ] as const)('defaults to the %s level when LOG_LEVEL is unset', (nodeEnv, level) => {
      expect(options({ NODE_ENV: nodeEnv }).level).toBe(level);
    });

    it('uses LOG_LEVEL over the NODE_ENV default when set', () => {
      expect(options({ LOG_LEVEL: 'error', NODE_ENV: 'production' }).level).toBe('error');
    });
  });

  describe('framework context filter', () => {
    it.each(FILTERED_LOG_CONTEXTS)('drops logs from the %s context', (context) => {
      build().info({ context }, 'framework chatter');

      expect(lines).toHaveLength(0);
    });

    it.each(['Bootstrap', 'GreetingService'])('keeps logs from the %s context', (context) => {
      build().info({ context }, 'app message');

      expect(lines).toHaveLength(1);
      expect(lines.join('')).toContain('app message');
    });

    it('keeps logs without a context', () => {
      build().info('plain message');

      expect(lines).toHaveLength(1);
    });

    it('keeps logs whose first argument is a string', () => {
      build().warn('just text');

      expect(lines).toHaveLength(1);
    });
  });

  it('pretty-prints only in development', () => {
    expect(options({ NODE_ENV: 'development' }).transport).toMatchObject({ target: 'pino-pretty' });
    expect(options({ NODE_ENV: 'production' }).transport).toBeUndefined();
  });
});
