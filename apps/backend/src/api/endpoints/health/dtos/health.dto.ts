import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { JOB_STATUSES } from '@/modules/jobs/job.js';

const CheckSchema = z.enum(['up', 'down']);

export class HealthDto extends createZodDto(
  z.object({
    checks: z.object({ database: CheckSchema, queue: CheckSchema }),
    counts: z.record(z.enum(JOB_STATUSES), z.number().int().min(0)),
    status: z.enum(['ok', 'down']),
  }),
) {}
