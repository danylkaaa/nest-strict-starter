import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DatabaseConfigSchema = z.object({
  pool: z
    .object({
      max: z.coerce.number().int().min(1),
      min: z.coerce.number().int().min(1),
    })
    .default({
      max: 5,
      min: 1,
    }),
  timeout_ms: z.coerce.number().int().min(1).max(60_000).default(3000),
  url: z.url({ protocol: /^postgres(ql)?$/u }),
});

export class DatabaseConfig extends createZodDto(DatabaseConfigSchema) {}
