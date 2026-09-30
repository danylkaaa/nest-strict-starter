import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const HealthResponseSchema = z.object({
  postgres: z.literal('up'),
  status: z.literal('ok'),
});

export class HealthResponseDto extends createZodDto(HealthResponseSchema) {}
