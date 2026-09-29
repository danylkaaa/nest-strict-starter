import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/** Environment variables in, camelCase typed config out. Add new settings here. */
export const AppConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
  }))

/** Injection token and type of the validated config: `constructor(private readonly config: AppConfig)`. */
export class AppConfig extends createZodDto(AppConfigSchema) {}
