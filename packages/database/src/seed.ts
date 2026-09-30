import { config } from 'dotenv';
import { Pool } from 'pg';

import { createDrizzleInstance } from './client.js';
import { aircraft, airports } from './schema.js';
import { aircraftSeed } from './seed-data/aircraft.js';
import { airportSeed } from './seed-data/airports.js';

config({ path: '../../.env', quiet: true });

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is required to seed the database.');

const pool = new Pool({ connectionString: url });
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
