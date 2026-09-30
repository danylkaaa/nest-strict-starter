import type { QueueName } from '@/common/queue/queue.service.js';

export const JOB_STATUSES = [
  'scheduled',
  'pending',
  'processing',
  'cancelled',
  'completed',
  'failed',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobResult = { emailId: string } | { webhookCallId: string } | { reportId: string };

export interface CreateJobInput<TPayload extends object = object> {
  idempotencyKey: string;
  priority: number;
  /** First attempt plus retries; pg-boss `retryLimit` is this minus one. */
  maxAttempts: number;
  type: 'instant' | 'schedule';
  startAt?: Date;
  payload: TPayload;
}
export interface JobActivity {
  id: string;
  event:
    | 'created'
    | 'started'
    | 'attempt_failed'
    | 'cancelled'
    | 'completed'
    | 'failed'
    | 'retried';
  attempt: number | null;
  errorCategory: string | null;
  recordedAt: Date;
}

/** A job row with the figures the UI lists; `status` is the effective status. */
export interface JobSummary {
  id: string;
  /** Batch the job belongs to, or null for a standalone job. */
  batchId: string | null;
  queue: QueueName;
  status: JobStatus;
  priority: number;
  maxAttempts: number;
  /** Number of `started` activity events. */
  attempts: number;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  result: JobResult | null;
  createdAt: Date;
  startAt: Date;
  /** Time of the terminal event while the job is completed, failed, or cancelled. */
  completedAt: Date | null;
  /** Category of the latest `attempt_failed` event. */
  lastErrorCategory: string | null;
}

export interface Job extends JobSummary {
  activity: JobActivity[];
}

export interface ListJobsInput {
  queue?: QueueName;
  statuses?: JobStatus[];
  search?: string;
  page: number;
  pageSize: number;
}

export interface JobsPage {
  items: JobSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface JobStats {
  counts: Record<JobStatus, number>;
  healthy: boolean;
}
