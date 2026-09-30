import { z } from 'zod';

import { QUEUES } from '@/common/queue/queue.service.js';
import { JOB_STATUSES } from '@/modules/jobs/job.js';

import type { JobSummary } from '@/modules/jobs/job.js';

export const JobStatusSchema = z.enum(JOB_STATUSES);

/** Fields shared by a list item and the single-job response. */
export const JobSummarySchema = z.object({
  attempts: z.number().int(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  idempotencyKey: z.uuid(),
  lastErrorCategory: z.string().nullable(),
  maxAttempts: z.number().int(),
  payload: z.record(z.string(), z.unknown()),
  priority: z.number().int(),
  queue: z.enum(QUEUES),
  result: z
    .union([
      z.object({ emailId: z.string() }),
      z.object({ webhookCallId: z.string() }),
      z.object({ reportId: z.string() }),
    ])
    .nullable(),
  startAt: z.iso.datetime(),
  status: JobStatusSchema,
});

export const toJobSummaryResponse = (job: JobSummary): z.input<typeof JobSummarySchema> => ({
  attempts: job.attempts,
  completedAt: job.completedAt?.toISOString() ?? null,
  createdAt: job.createdAt.toISOString(),
  id: job.id,
  idempotencyKey: job.idempotencyKey,
  lastErrorCategory: job.lastErrorCategory,
  maxAttempts: job.maxAttempts,
  payload: job.payload,
  priority: job.priority,
  queue: job.queue,
  result: job.result,
  startAt: job.startAt.toISOString(),
  status: job.status,
});
