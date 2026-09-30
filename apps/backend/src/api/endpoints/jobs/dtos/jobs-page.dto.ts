import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { JobSummarySchema } from './job-summary.schema.js';

export class JobsPageDto extends createZodDto(
  z.object({
    items: z.array(JobSummarySchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(1),
  }),
) {}
