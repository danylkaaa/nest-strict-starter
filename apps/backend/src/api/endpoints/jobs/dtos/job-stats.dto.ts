import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { JobStatusSchema } from './job-summary.schema.js';

export class JobStatsDto extends createZodDto(
  z.object({
    counts: z.record(JobStatusSchema, z.number().int().min(0)),
    healthy: z.boolean(),
  }),
) {}
