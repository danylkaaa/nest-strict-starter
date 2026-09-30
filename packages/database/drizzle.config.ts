import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ quiet: true });

export default defineConfig({
  dbCredentials: { url: process.env['DATABASE_URL'] ?? '' },
  dialect: 'postgresql',
  out: './migrations',
  schema: './src/schema.ts',
});
