import type { CreateEmailJobInput, EmailJob } from '@/modules/jobs/job.js';

export interface JobLogWrite {
  attempt?: number;
  errorCategory?: string;
  event: EmailJob['activity'][number]['event'];
  eventKey: string;
}

export interface JobTransition {
  status: EmailJob['status'];
  result?: EmailJob['result'];
  logs: JobLogWrite[];
}

export const JOB_REPOSITORY = Symbol('JobRepository');
export interface JobRepository {
  hasSubmission(idempotencyKey: string): Promise<boolean>;
  create(input: CreateEmailJobInput): Promise<{ id: string; startAt: Date; duplicate: boolean }>;
  getJob(id: string): Promise<Omit<EmailJob, 'activity'> | null>;
  getJobActivity(id: string): Promise<EmailJob['activity']>;
  getQueueJob(id: string): Promise<{ state: string; startAfter: Date; retryCount: number } | null>;
  setJobStatus(id: string, status: EmailJob['status']): Promise<void>;
  addJobLog(
    id: string,
    event: EmailJob['activity'][number]['event'],
    eventKey: string,
    attempt?: number,
    errorCategory?: string,
  ): Promise<void>;
  listProcessingJobIds(): Promise<string[]>;
  cancelJob(id: string): Promise<'cancelled' | 'not_found' | 'not_cancellable'>;
  writeJobTransition(id: string, transition: JobTransition): Promise<void>;
}
