import { unflatten } from 'flat';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { LoggerConfigSchema } from '@/api/core/logger/logger.schema';
import { DatabaseConfigSchema } from '@/common/database/database.config';

import { HttpConfigSchema } from './http.config.js';

export const ApiConfigSchema = z.object({
  http: HttpConfigSchema,
  logger: LoggerConfigSchema,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  postgres: DatabaseConfigSchema,
});

export class ApiConfig extends createZodDto(ApiConfigSchema) {}

export function parseApiConfig(env: Record<string, string | undefined>): ApiConfig {
  return ApiConfigSchema.parse(
    unflatten<typeof env, unknown>(env, { delimiter: '__', object: true }),
  );
}
