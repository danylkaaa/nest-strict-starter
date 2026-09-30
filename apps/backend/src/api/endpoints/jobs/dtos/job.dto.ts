import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { JobSummarySchema } from './job-summary.schema.js';

export class JobDto extends createZodDto(
  JobSummarySchema.extend({
    activity: z.array(
      z.object({
        attempt: z.number().int().nullable(),
        errorCategory: z.string().nullable(),
        event: z.enum([
          'created',
          'started',
          'attempt_failed',
          'cancelled',
          'completed',
          'failed',
          'retried',
        ]),
        id: z.string(),
        recordedAt: z.iso.datetime(),
      }),
    ),
  }),
) {}
