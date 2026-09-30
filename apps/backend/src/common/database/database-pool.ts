import { Pool } from 'pg';

import type { DatabaseConfig } from './database.config.js';

export function createDatabasePool(config: DatabaseConfig): Pool {
  return new Pool({
    connectionString: config.url,
    connectionTimeoutMillis: config.timeout_ms,
    max: config.pool.max,
    min: config.pool.min,
  });
}
