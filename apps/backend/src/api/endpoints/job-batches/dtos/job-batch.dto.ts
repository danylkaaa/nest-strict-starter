import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { JobBatchChildSchema, JobBatchSummarySchema } from './job-batch.schema.js';

export class JobBatchDto extends createZodDto(
  JobBatchSummarySchema.extend({ items: z.array(JobBatchChildSchema) }),
) {}
