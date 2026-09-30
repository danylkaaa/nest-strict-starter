import type { QueueName } from '@/common/queue/queue.service.js';
import type { CreateJobInput, Job, JobResult } from '@/modules/jobs/job.js';

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
  hasSubmission(idempotencyKey: string): Promise<boolean>;
  create(
    queue: QueueName,
    input: CreateJobInput,
  ): Promise<{ id: string; startAt: Date; duplicate: boolean }>;
  getJob(id: string): Promise<Omit<Job, 'activity'> | null>;
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
  writeJobTransition(id: string, transition: JobTransition): Promise<void>;
}
