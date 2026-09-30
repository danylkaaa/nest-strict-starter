import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class JobDto extends createZodDto(
  z.object({
    activity: z.array(
      z.object({
        attempt: z.number().int().nullable(),
        errorCategory: z.string().nullable(),
        event: z.enum(['created', 'started', 'attempt_failed', 'cancelled', 'completed', 'failed']),
        id: z.string(),
        recordedAt: z.iso.datetime(),
      }),
    ),
    id: z.uuid(),
    priority: z.number().int(),
    result: z.object({ emailId: z.string() }).nullable(),
    startAt: z.iso.datetime(),
    status: z.enum(['scheduled', 'pending', 'processing', 'cancelled', 'completed', 'failed']),
  }),
) {}
