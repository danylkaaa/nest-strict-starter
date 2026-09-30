import type { QueueName } from '@/common/queue/queue.service.js';
import type {
  ChildProgress,
  JobBatchChild,
  JobBatchRecord,
  ListJobBatchesInput,
} from '@/modules/jobs/job-batch.js';
import type {
  CreateJobInput,
  Job,
  JobResult,
  JobStatus,
  JobSummary,
  ListJobsInput,
} from '@/modules/jobs/job.js';

export interface JobLogWrite {
  attempt?: number;
  errorCategory?: string;
  event: Job['activity'][number]['event'];
  eventKey: string;
}

export interface BatchChildInsert {
  queue: QueueName;
  /** Internal submission key; clients supply only the batch key. */
  idempotencyKey: string;
  payload: object;
}

export interface BatchInsert {
  idempotencyKey: string;
  priority: number;
  maxAttempts: number;
  type: 'instant' | 'schedule';
  startAt?: Date;
  items: BatchChildInsert[];
}

export interface JobTransition {
  /**
   * When set and the job's batch has a cancellation request, the write is a terminal failure of
   * this attempt instead of `status`; the decision is made under the job row lock.
   */
  failedAttemptInCancelledBatch?: { attempt: number; category: string };
  status: Job['status'];
  result?: JobResult;
  /** Sets the pg-boss job's fixed retry delay in the same transaction. */
  retryDelaySeconds?: number;
  logs: JobLogWrite[];
}

export const JOB_REPOSITORY = Symbol('JobRepository');
export interface JobRepository {
  /** ID of the job stored for the submission key, or null when the key is unused. */
  findSubmission(idempotencyKey: string): Promise<string | null>;
  create(
    queue: QueueName,
    input: CreateJobInput,
  ): Promise<{ id: string; startAt: Date; duplicate: boolean }>;
  getJob(id: string): Promise<JobSummary | null>;
  /** Page of jobs (newest first) and the total number matching the filters. */
  listJobs(input: ListJobsInput): Promise<{ items: JobSummary[]; total: number }>;
  countJobsByStatus(): Promise<Record<JobStatus, number>>;
  /** True when both the database and the pg-boss queue answer. */
  isHealthy(): Promise<boolean>;
  getJobActivity(id: string): Promise<Job['activity']>;
  getQueueJob(
    queue: QueueName,
    id: string,
  ): Promise<{ state: string; startAfter: Date; retryCount: number } | null>;
  setJobStatus(id: string, status: Job['status']): Promise<void>;
  addJobLog(
    id: string,
    event: Job['activity'][number]['event'],
    eventKey: string,
    attempt?: number,
    errorCategory?: string,
  ): Promise<void>;
  listProcessingJobs(): Promise<{ id: string; queue: QueueName }[]>;
  cancelJob(queue: QueueName, id: string): Promise<'cancelled' | 'not_found' | 'not_cancellable'>;
  /** Grants one more attempt to a failed job in one transaction with the queue-row lock. */
  retryJob(queue: QueueName, id: string): Promise<'retried' | 'not_found' | 'not_retryable'>;
  /** Writes the transition in one transaction and returns the status that was stored. */
  writeJobTransition(id: string, transition: JobTransition): Promise<Job['status']>;
  /** ID of the batch stored for the batch key, or null when the key is unused. */
  findBatchSubmission(idempotencyKey: string): Promise<string | null>;
  /**
   * Inserts the batch, every child row and `created` event, and every queue job in one
   * transaction under the batch key's advisory lock; any failure leaves nothing behind.
   */
  createBatch(input: BatchInsert): Promise<{ id: string; startAt: Date; duplicate: boolean }>;
  /** The batch and its children in position order, read from one database snapshot. */
  getJobBatch(id: string): Promise<{ batch: JobBatchRecord; children: JobBatchChild[] } | null>;
  /** Page of batches (newest first) with their children's progress figures, from one snapshot. */
  listJobBatches(
    input: ListJobBatchesInput,
  ): Promise<{ items: { batch: JobBatchRecord; children: ChildProgress[] }[]; total: number }>;
  /**
   * Records the cancellation request once and cancels every unclaimed child in one transaction
   * that locks the batch row, then the child rows and queue rows in position order.
   */
  cancelJobBatch(
    id: string,
  ): Promise<'cancelled' | 'already_requested' | 'not_found' | 'not_cancellable'>;
}
