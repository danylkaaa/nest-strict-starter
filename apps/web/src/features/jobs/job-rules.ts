import type { BatchStatus, DisplayStatus, Job, JobStatus, JobType } from './job';

// Same rules the API enforces; the UI uses them to show or hide actions

const CANCELLABLE_BATCH = new Set<BatchStatus>(['scheduled', 'pending', 'processing']);

/**
 * A batch can be cancelled until every child is finished or a cancellation was requested; a child
 * of a batch only through its batch. A standalone job can be cancelled before a worker claims it.
 */
export const canCancel = (job: Job): boolean => {
  if (job.batchId !== null) return false;
  if (job.type === 'batch') return CANCELLABLE_BATCH.has(job.batchStatus);
  return job.status === 'scheduled' || job.status === 'pending';
};

/** Only a failed standalone job; the API refuses to retry a batch child and has no batch retry */
export const canRetry = (job: Job): boolean =>
  job.status === 'failed' && job.batchId === null && job.type !== 'batch';

/** The status a badge shows: a batch shows its own derived status */
export const displayStatus = (job: Job): DisplayStatus =>
  job.type === 'batch' ? job.batchStatus : job.status;

/** Route of a job's detail page; a batch has its own route because its ID is a batch ID */
export const jobPath = (job: Pick<Job, 'id' | 'type'>): string =>
  job.type === 'batch' ? `/batches/${job.id}` : `/jobs/${job.id}`;

/** The job status that stands for a batch status in filters and counts */
export const COARSE_STATUS: Record<BatchStatus, JobStatus> = {
  cancelled: 'cancelled',
  cancelling: 'processing',
  completed: 'completed',
  completed_with_errors: 'failed',
  pending: 'pending',
  processing: 'processing',
  scheduled: 'scheduled',
};

export const STATUS_PALETTE: Record<DisplayStatus, string> = {
  cancelled: 'gray',
  cancelling: 'orange',
  completed: 'green',
  completed_with_errors: 'orange',
  failed: 'red',
  pending: 'gray',
  processing: 'blue',
  scheduled: 'purple',
};

export const TYPE_LABEL: Record<JobType, string> = {
  batch: 'Batch',
  email: 'Email',
  transit: 'Aircraft',
  webhook: 'Webhook',
};

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  cancelled: 'Cancelled',
  cancelling: 'Cancelling',
  completed: 'Completed',
  completed_with_errors: 'Completed with errors',
  failed: 'Failed',
  pending: 'Pending',
  processing: 'Processing',
  scheduled: 'Scheduled',
};
