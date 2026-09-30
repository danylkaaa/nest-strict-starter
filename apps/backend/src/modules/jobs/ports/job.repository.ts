import type { QueueName } from '@/common/queue/queue.service.js';
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

export interface JobTransition {
  status: Job['status'];
  result?: JobResult;
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
  writeJobTransition(id: string, transition: JobTransition): Promise<void>;
}
