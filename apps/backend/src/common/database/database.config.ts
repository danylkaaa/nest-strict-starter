import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DatabaseConfigSchema = z.object({
  database: z.string().min(1),
  host: z.string().min(1).default('localhost'),
  password: z.string(),
  pool: z
    .object({
      max: z.coerce.number().int().min(1),
      min: z.coerce.number().int().min(1),
    })
    .default({
      max: 5,
      min: 1,
    }),
  port: z.coerce.number().int().min(1).max(65_535),
  timeout_ms: z.coerce.number().int().min(1).max(60_000).default(3000),
  user: z.string().min(1),
});

export class DatabaseConfig extends createZodDto(DatabaseConfigSchema) {}

/**
 * Maps the root `.env` PostgreSQL variables to the connection fields of `DatabaseConfigSchema`.
 * Shared by the API and worker so both read the same variables; the schema validates the values.
 */
export function readDatabaseConnectionEnv(env: Record<string, string | undefined>): {
  database: string | undefined;
  host: string | undefined;
  password: string | undefined;
  port: string | undefined;
  user: string | undefined;
} {
  return {
    database: env.DATABASE_NAME,
    host: env.POSTGRES_HOST === '' ? undefined : env.POSTGRES_HOST,
    password: env.POSTGRES_PASSWORD,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
  };
}
