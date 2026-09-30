import type { QueueName } from '@/common/queue/queue.service.js';

export type JobOutcome = 'pickup' | 'completed' | 'retry_scheduled' | 'failed' | 'invalid_payload';

/** Safe log fields only: queue name, job ID, attempt, and outcome. Never payload content. */
export function jobLog(
  queue: QueueName,
  jobId: string,
  attempt: number,
  outcome: JobOutcome,
): {
  attempt: number;
  jobId: string;
  outcome: JobOutcome;
  queue: QueueName;
} {
  return { attempt, jobId, outcome, queue };
}
