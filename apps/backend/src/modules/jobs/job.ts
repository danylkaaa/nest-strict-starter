import type { EmailContent } from '@/modules/emails/email.js';

export type JobStatus =
  | 'scheduled'
  | 'pending'
  | 'processing'
  | 'cancelled'
  | 'completed'
  | 'failed';
export interface CreateEmailJobInput {
  idempotencyKey: string;
  priority: number;
  type: 'instant' | 'schedule';
  startAt?: Date;
  payload: EmailContent;
}
export interface JobActivity {
  id: string;
  event: 'created' | 'started' | 'attempt_failed' | 'cancelled' | 'completed' | 'failed';
  attempt: number | null;
  errorCategory: string | null;
  recordedAt: Date;
}
export interface EmailJob {
  id: string;
  priority: number;
  result: { emailId: string } | null;
  status: JobStatus;
  startAt: Date;
  activity: JobActivity[];
}
