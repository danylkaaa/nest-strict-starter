import type { CreateEmailJobInput, EmailJob } from '@/modules/jobs/job.js';

export const JOB_REPOSITORY = Symbol('JobRepository');
export interface JobRepository {
  hasSubmission(idempotencyKey: string): Promise<boolean>;
  create(input: CreateEmailJobInput): Promise<{ id: string; startAt: Date; duplicate: boolean }>;
  get(id: string): Promise<EmailJob | null>;
  cancel(id: string): Promise<'cancelled' | 'not_found' | 'not_cancellable'>;
  recordStart(id: string, attempt: number): Promise<void>;
  recordFailure(id: string, attempt: number, category: string, terminal: boolean): Promise<void>;
  recordCompletion(id: string, attempt: number, emailId: string): Promise<void>;
  reconcileProcessing(): Promise<void>;
}
