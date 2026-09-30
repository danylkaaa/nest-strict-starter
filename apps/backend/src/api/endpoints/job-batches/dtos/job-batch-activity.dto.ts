import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { QUEUES } from '@/common/queue/queue.service.js';

import type { JobBatchActivityEntry } from '@/modules/jobs/job-batch.js';

export const JobBatchActivityEntrySchema = z.object({
  attempt: z.number().int().nullable(),
  errorCategory: z.string().nullable(),
  event: z.enum([
    'batch_created',
    'cancellation_requested',
    'created',
    'started',
    'attempt_failed',
    'cancelled',
    'completed',
    'failed',
    'retried',
  ]),
  id: z.string(),
  /** Null for the batch-level entries. */
  jobId: z.uuid().nullable(),
  /** 1-based task position; null for the batch-level entries. */
  position: z.number().int().min(1).nullable(),
  queue: z.enum(QUEUES).nullable(),
  recordedAt: z.iso.datetime(),
});

export const toJobBatchActivityResponse = (
  entry: JobBatchActivityEntry,
): z.input<typeof JobBatchActivityEntrySchema> => ({
  ...entry,
  recordedAt: entry.recordedAt.toISOString(),
});

/** Oldest first; one feed for the whole batch. */
export class JobBatchActivityDto extends createZodDto(
  z.object({ items: z.array(JobBatchActivityEntrySchema) }),
) {}
