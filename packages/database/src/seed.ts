import { config } from 'dotenv';
import { Pool } from 'pg';

import { createDrizzleInstance } from './client.js';
import { aircraft, airports } from './schema.js';
import { aircraftSeed } from './seed-data/aircraft.js';
import { airportSeed } from './seed-data/airports.js';

config({ path: '../../.env', quiet: true });

const { DATABASE_NAME, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER } =
  process.env;
const missing = Object.entries({ DATABASE_NAME, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER })
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length > 0) {
  throw new Error(`${missing.join(', ')} required to seed the database.`);
}

const pool = new Pool({
  database: DATABASE_NAME,
  host: (POSTGRES_HOST === '' ? undefined : POSTGRES_HOST) ?? 'localhost',
  password: POSTGRES_PASSWORD,
  port: Number(POSTGRES_PORT),
  user: POSTGRES_USER,
});
try {
  const database = createDrizzleInstance(pool);
  // Conflicts on the ICAO primary key and the unique registration make reruns no-ops.
  await database.insert(airports).values(airportSeed).onConflictDoNothing();
  await database.insert(aircraft).values(aircraftSeed).onConflictDoNothing();
  process.stdout.write(
    `Seeded reference data: ${airportSeed.length} airports, ${aircraftSeed.length} aircraft.\n`,
  );
} finally {
  await pool.end();
}
