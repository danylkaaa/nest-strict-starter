import type { JobActivity, JobStatus, JobSummary } from './job.js';
import type { QueueName } from '@/common/queue/queue.service.js';
import type { TransitRequest } from '@/modules/aircraft-transits/aircraft-transit.js';
import type { EmailContent } from '@/modules/emails/email.js';
import type { WebhookContent } from '@/modules/webhooks/webhook.js';

export const JOB_BATCH_STATUSES = [
  'scheduled',
  'pending',
  'processing',
  'cancelling',
  'cancelled',
  'completed',
  'completed_with_errors',
] as const;

export type JobBatchStatus = (typeof JOB_BATCH_STATUSES)[number];

/** Batches hold 1 to 100 children. */
export const MIN_BATCH_ITEMS = 1;
export const MAX_BATCH_ITEMS = 100;

export type JobBatchItem =
  | { type: 'email'; payload: EmailContent }
  | { type: 'webhook'; payload: WebhookContent }
  | { type: 'aircraft-report'; payload: TransitRequest };

export interface CreateJobBatchInput {
  idempotencyKey: string;
  priority: number;
  maxAttempts: number;
  type: 'instant' | 'schedule';
  startAt?: Date;
  items: JobBatchItem[];
}

/** The persisted batch row; status and progress are derived from the children on read. */
export interface JobBatchRecord {
  id: string;
  idempotencyKey: string;
  /** Shared by every child; read from the first child, not stored on the batch. */
  priority: number;
  maxAttempts: number;
  startAt: Date;
  createdAt: Date;
  cancellationRequestedAt: Date | null;
}

/** The figures of a child that decide the batch's derived status and progress. */
export type ChildProgress = Pick<JobSummary, 'attempts' | 'status'>;

export interface JobBatchSummary extends JobBatchRecord {
  status: JobBatchStatus;
  total: number;
  counts: Record<JobStatus, number>;
  /** `round(100 * (completed + failed + cancelled) / total)`; a processing child is unfinished. */
  progress: number;
}

export interface JobBatchChild {
  /** 1-based position in the submitted order. */
  position: number;
  job: JobSummary;
}

export interface JobBatch extends JobBatchSummary {
  items: JobBatchChild[];
}

export interface ListJobBatchesInput {
  page: number;
  pageSize: number;
}

export interface JobBatchesPage {
  items: JobBatchSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const TERMINAL = new Set<JobStatus>(['completed', 'failed', 'cancelled']);

export const countByStatus = (children: readonly ChildProgress[]): Record<JobStatus, number> => {
  const counts: Record<JobStatus, number> = {
    cancelled: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    scheduled: 0,
  };
  for (const child of children) counts[child.status] += 1;
  return counts;
};

export const batchProgress = (counts: Record<JobStatus, number>, total: number): number =>
  total === 0
    ? 0
    : Math.round((100 * (counts.completed + counts.failed + counts.cancelled)) / total);

/**
 * Derives the batch status from the persisted children at read time. Cancellation intent wins over
 * the mix of child outcomes once every child is terminal.
 */
export const deriveBatchStatus = (
  batch: Pick<JobBatchRecord, 'cancellationRequestedAt' | 'startAt'>,
  children: readonly ChildProgress[],
  now: Date,
): JobBatchStatus => {
  const settled = children.every((child) => TERMINAL.has(child.status));
  if (batch.cancellationRequestedAt !== null) return settled ? 'cancelled' : 'cancelling';
  if (settled) {
    return children.every((child) => child.status === 'completed')
      ? 'completed'
      : 'completed_with_errors';
  }
  if (batch.startAt.getTime() > now.getTime()) return 'scheduled';
  const started = children.some(
    (child) => child.attempts > 0 || child.status === 'processing' || TERMINAL.has(child.status),
  );
  return started ? 'processing' : 'pending';
};

export const summarizeBatch = (
  batch: JobBatchRecord,
  children: readonly ChildProgress[],
  now: Date,
): JobBatchSummary => {
  const counts = countByStatus(children);
  return {
    ...batch,
    counts,
    progress: batchProgress(counts, children.length),
    status: deriveBatchStatus(batch, children, now),
    total: children.length,
  };
};

export const toJobBatch = (
  batch: JobBatchRecord,
  children: readonly JobBatchChild[],
  now: Date,
): JobBatch => ({
  ...summarizeBatch(
    batch,
    children.map((child) => child.job),
    now,
  ),
  items: [...children],
});

/** One activity event of a child, tagged with the child it belongs to. */
export interface JobBatchActivityRow {
  id: string;
  jobId: string;
  queue: QueueName;
  /** 1-based position of the child in the submitted order. */
  position: number;
  event: JobActivity['event'];
  attempt: number | null;
  errorCategory: string | null;
  recordedAt: Date;
}

/** A child event, or a batch-level entry (`jobId`, `queue`, and `position` are then null). */
export interface JobBatchActivityEntry {
  id: string;
  event: JobActivity['event'] | 'batch_created' | 'cancellation_requested';
  jobId: string | null;
  queue: QueueName | null;
  position: number | null;
  attempt: number | null;
  errorCategory: string | null;
  recordedAt: Date;
}

const batchEntry = (
  batch: JobBatchRecord,
  event: 'batch_created' | 'cancellation_requested',
  recordedAt: Date,
): JobBatchActivityEntry => ({
  attempt: null,
  errorCategory: null,
  event,
  id: `${event}:${batch.id}`,
  jobId: null,
  position: null,
  queue: null,
  recordedAt,
});

/** At equal times: batch created, cancellation requested, then child events. */
const entryRank = (entry: JobBatchActivityEntry): number =>
  entry.event === 'batch_created' ? 0 : entry.event === 'cancellation_requested' ? 1 : 2;

const compareEntries = (a: JobBatchActivityEntry, b: JobBatchActivityEntry): number =>
  a.recordedAt.getTime() - b.recordedAt.getTime() ||
  entryRank(a) - entryRank(b) ||
  (a.position ?? 0) - (b.position ?? 0) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * One feed, oldest first, with a stable tie-break (time, kind, position, event ID): the synthetic
 * batch-created entry, every child event, and the cancellation request when one was recorded.
 */
export const buildBatchActivity = (
  batch: JobBatchRecord,
  rows: readonly JobBatchActivityRow[],
): JobBatchActivityEntry[] =>
  [
    batchEntry(batch, 'batch_created', batch.createdAt),
    ...rows,
    ...(batch.cancellationRequestedAt === null
      ? []
      : [batchEntry(batch, 'cancellation_requested', batch.cancellationRequestedAt)]),
  ].toSorted(compareEntries);
