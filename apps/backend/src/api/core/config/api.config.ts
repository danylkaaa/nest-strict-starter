import { unflatten } from 'flat';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { LoggerConfigSchema } from '@/api/core/logger/logger.schema';
import { DatabaseConfigSchema, readDatabaseConnectionEnv } from '@/common/database/database.config';

import { HttpConfigSchema } from './http.config.js';

export const ApiConfigSchema = z.object({
  http: HttpConfigSchema.default(() => HttpConfigSchema.parse({})),
  logger: LoggerConfigSchema.default({}),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  postgres: DatabaseConfigSchema,
});

export class ApiConfig extends createZodDto(ApiConfigSchema) {}

function prefixPostgresKeys(
  connection: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(connection).map(([key, value]) => [`postgres__${key}`, value]),
  );
}

export function parseApiConfig(env: Record<string, string | undefined>): ApiConfig {
  return ApiConfigSchema.parse(
    unflatten<typeof env, unknown>(
      { ...env, ...prefixPostgresKeys(readDatabaseConnectionEnv(env)) },
      { delimiter: '__', object: true },
    ),
  );
}
