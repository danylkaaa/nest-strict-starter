import { EMAIL_QUEUE } from '@/common/queue/queue.service.js';

export type JobOutcome = 'pickup' | 'completed' | 'retry_scheduled' | 'failed' | 'invalid_payload';

export function jobLog(
  jobId: string,
  attempt: number,
  outcome: JobOutcome,
): {
  attempt: number;
  jobId: string;
  outcome: JobOutcome;
  queue: string;
} {
  return { attempt, jobId, outcome, queue: EMAIL_QUEUE };
}
