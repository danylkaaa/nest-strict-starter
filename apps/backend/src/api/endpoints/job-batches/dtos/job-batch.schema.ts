import { z } from 'zod';

import { JobStatusSchema } from '@/api/endpoints/jobs/dtos/job-summary.schema.js';
import { QUEUES } from '@/common/queue/queue.service.js';
import { JOB_BATCH_STATUSES } from '@/modules/jobs/job-batch.js';

import type { JobBatch, JobBatchSummary } from '@/modules/jobs/job-batch.js';

export const JobBatchStatusSchema = z.enum(JOB_BATCH_STATUSES);

/** Fields shared by a list item and the batch detail. */
export const JobBatchSummarySchema = z.object({
  cancellationRequestedAt: z.iso.datetime().nullable(),
  counts: z.record(JobStatusSchema, z.number().int().min(0)),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  idempotencyKey: z.uuid(),
  maxAttempts: z.number().int(),
  priority: z.number().int(),
  progress: z.number().int().min(0).max(100),
  startAt: z.iso.datetime(),
  status: JobBatchStatusSchema,
  total: z.number().int().min(1),
});

export const JobBatchChildSchema = z.object({
  attempts: z.number().int(),
  completedAt: z.iso.datetime().nullable(),
  id: z.uuid(),
  lastErrorCategory: z.string().nullable(),
  /** Route of the child's own detail, which carries its activity. */
  link: z.string(),
  payload: z.record(z.string(), z.unknown()),
  position: z.number().int().min(1),
  queue: z.enum(QUEUES),
  result: z
    .union([
      z.object({ emailId: z.string() }),
      z.object({ webhookCallId: z.string() }),
      z.object({ reportId: z.string() }),
    ])
    .nullable(),
  status: JobStatusSchema,
});

export const toJobBatchSummaryResponse = (
  batch: JobBatchSummary,
): z.input<typeof JobBatchSummarySchema> => ({
  cancellationRequestedAt: batch.cancellationRequestedAt?.toISOString() ?? null,
  counts: batch.counts,
  createdAt: batch.createdAt.toISOString(),
  id: batch.id,
  idempotencyKey: batch.idempotencyKey,
  maxAttempts: batch.maxAttempts,
  priority: batch.priority,
  progress: batch.progress,
  startAt: batch.startAt.toISOString(),
  status: batch.status,
  total: batch.total,
});

export const toJobBatchChildrenResponse = (
  batch: JobBatch,
): z.input<typeof JobBatchChildSchema>[] =>
  batch.items.map(({ job, position }) => ({
    attempts: job.attempts,
    completedAt: job.completedAt?.toISOString() ?? null,
    id: job.id,
    lastErrorCategory: job.lastErrorCategory,
    link: `/api/jobs/${job.id}`,
    payload: job.payload,
    position,
    queue: job.queue,
    result: job.result,
    status: job.status,
  }));
