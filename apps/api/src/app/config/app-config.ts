import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AppConfigSchema = z.object({
  DATABASE_TIMEOUT_MS: z.coerce.number().int().min(1).max(60_000).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/u }),
  // Token lifetime in seconds (3600 = 1h); also returned as `expiresIn` by POST /auth/login
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(3600),
  // Signing secret for access tokens; required, no default
  JWT_SECRET: z.string().min(32),
  // Overrides the per-NODE_ENV default log level when set
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export class AppConfig extends createZodDto(AppConfigSchema) {}
