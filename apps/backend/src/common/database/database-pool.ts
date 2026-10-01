import { Pool } from 'pg';

import type { DatabaseConfig } from './database.config.js';

export function createDatabasePool(config: DatabaseConfig): Pool {
  return new Pool({
    connectionTimeoutMillis: config.timeout_ms,
    database: config.database,
    host: config.host,
    max: config.pool.max,
    min: config.pool.min,
    password: config.password,
    port: config.port,
    user: config.user,
  });
}
