import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AppConfigSchema = z.object({
  // Overrides the per-NODE_ENV default log level when set
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export class AppConfig extends createZodDto(AppConfigSchema) {}
