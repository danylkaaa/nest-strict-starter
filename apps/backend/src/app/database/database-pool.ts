import { Pool } from 'pg';

import type { AppConfig } from '@/app/config/app-config.js';
import type { PinoLogger } from 'nestjs-pino';

export function createDatabasePool(
  config: Pick<AppConfig, 'DATABASE_TIMEOUT_MS' | 'DATABASE_URL'>,
  logger: PinoLogger,
): Pool {
  logger.setContext('DatabasePool');
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: config.DATABASE_TIMEOUT_MS,
    query_timeout: config.DATABASE_TIMEOUT_MS,
    statement_timeout: config.DATABASE_TIMEOUT_MS,
  });
  pool.on('error', (error: Error & { code?: unknown }) => {
    const code =
      typeof error.code === 'string' && /^[A-Z0-9_]{1,32}$/u.test(error.code)
        ? error.code
        : 'UNKNOWN';
    logger.error({ code }, 'Idle database connection lost');
  });
  return pool;
}
