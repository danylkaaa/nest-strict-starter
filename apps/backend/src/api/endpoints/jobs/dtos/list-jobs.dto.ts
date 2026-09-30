import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { QUEUES } from '@/common/queue/queue.service.js';

import { JobStatusSchema } from './job-summary.schema.js';

export class ListJobsDto extends createZodDto(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    queue: z.enum(QUEUES).optional(),
    search: z.string().trim().max(200).optional(),
    status: z
      .string()
      .transform((value) => value.split(',').map((status) => status.trim()))
      .pipe(z.array(JobStatusSchema).min(1))
      .optional(),
  }),
) {}
