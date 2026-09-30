import type { QueueName } from '@/common/queue/queue.service.js';

export type JobStatus =
  | 'scheduled'
  | 'pending'
  | 'processing'
  | 'cancelled'
  | 'completed'
  | 'failed';

export type JobResult = { emailId: string } | { webhookCallId: string } | { reportId: string };

export interface CreateJobInput<TPayload extends object = object> {
  idempotencyKey: string;
  priority: number;
  type: 'instant' | 'schedule';
  startAt?: Date;
  payload: TPayload;
}
export interface JobActivity {
  id: string;
  event: 'created' | 'started' | 'attempt_failed' | 'cancelled' | 'completed' | 'failed';
  attempt: number | null;
  errorCategory: string | null;
  recordedAt: Date;
}
export interface Job {
  id: string;
  queue: QueueName;
  priority: number;
  result: JobResult | null;
  status: JobStatus;
  startAt: Date;
  activity: JobActivity[];
}
