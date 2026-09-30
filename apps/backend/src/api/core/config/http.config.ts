import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const HttpConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export class HttpConfig extends createZodDto(HttpConfigSchema) {}
