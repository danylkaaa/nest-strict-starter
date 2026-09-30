import { createMock } from '@golevelup/ts-vitest';
import { describe, expect, it } from 'vitest';

import { createDatabasePool } from '@/app/database/database-pool.js';

import type { PinoLogger } from 'nestjs-pino';

describe('database pool', () => {
  it('handles idle connection errors without logging error messages or clients', async () => {
    const logger = createMock<PinoLogger>();
    const pool = createDatabasePool(
      { DATABASE_TIMEOUT_MS: 3000, DATABASE_URL: 'postgresql://test:test@localhost/test' },
      logger,
    );
    const error = Object.assign(new Error('secret connection details'), { code: '57P01' });

    expect(() => pool.emit('error', error, { password: 'secret' })).not.toThrow();
    await pool.end();

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      { code: '57P01' },
      'Idle database connection lost',
    );
    expect(logger.setContext).toHaveBeenCalledWith('DatabasePool');
  });

  it('replaces unexpected diagnostic codes with a fixed safe value', async () => {
    const logger = createMock<PinoLogger>();
    const pool = createDatabasePool(
      { DATABASE_TIMEOUT_MS: 3000, DATABASE_URL: 'postgresql://test:test@localhost/test' },
      logger,
    );
    const error = Object.assign(new Error('secret'), { code: 'postgresql://user:secret@host/db' });

    pool.emit('error', error);
    await pool.end();

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      { code: 'UNKNOWN' },
      'Idle database connection lost',
    );
  });
});
