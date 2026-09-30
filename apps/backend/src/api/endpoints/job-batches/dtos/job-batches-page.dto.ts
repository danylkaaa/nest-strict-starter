import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { JobBatchSummarySchema } from './job-batch.schema.js';

export class JobBatchesPageDto extends createZodDto(
  z.object({
    items: z.array(JobBatchSummarySchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(1),
  }),
) {}
