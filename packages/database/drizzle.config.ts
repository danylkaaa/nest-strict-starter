import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '../../.env', quiet: true });

export default defineConfig({
  dbCredentials: {
    database: process.env['DATABASE_NAME'] ?? '',
    host:
      (process.env['POSTGRES_HOST'] === '' ? undefined : process.env['POSTGRES_HOST']) ??
      'localhost',
    password: process.env['POSTGRES_PASSWORD'],
    port: Number(process.env['POSTGRES_PORT']),
    ssl: false,
    user: process.env['POSTGRES_USER'],
  },
  dialect: 'postgresql',
  out: './migrations',
  schema: './src/schema.ts',
});
