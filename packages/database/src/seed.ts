import { Pool } from 'pg';

import { createDatabase } from './client.js';
import { createDefaultUser } from './default-user.js';
import { users } from './schema.js';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const pool = new Pool({ connectionString });
try {
  const database = createDatabase(pool);
  await database
    .insert(users)
    .values(await createDefaultUser())
    .onConflictDoNothing({ target: users.email });
  process.stdout.write('Default user seed complete; existing accounts were preserved.\n');
} catch {
  process.stderr.write('Database seed failed. Check the connection and apply migrations first.\n');
  process.exitCode = 1;
} finally {
  await pool.end();
}
