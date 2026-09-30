import { drizzle } from 'drizzle-orm/node-postgres';

import * as schema from './schema.js';

import type { Pool } from 'pg';

export const createDrizzleInstance = (pool: Pool) => drizzle(pool, { schema });
export type Database = ReturnType<typeof createDrizzleInstance>;
