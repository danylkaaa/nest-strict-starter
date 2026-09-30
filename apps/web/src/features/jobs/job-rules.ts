import type { Job, JobStatus, JobType } from './job';

// Same rules the API enforces; the UI uses them to show or hide actions

export const canCancel = (job: Pick<Job, 'status' | 'type'>): boolean =>
  job.status === 'scheduled' ||
  job.status === 'pending' ||
  (job.status === 'processing' && job.type === 'batch');

export const canRetry = (job: Pick<Job, 'status'>): boolean => job.status === 'failed';

export const STATUS_PALETTE: Record<JobStatus, string> = {
  cancelled: 'gray',
  completed: 'green',
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

export const STATUS_LABEL: Record<JobStatus, string> = {
  cancelled: 'Cancelled',
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Pending',
  processing: 'Processing',
  scheduled: 'Scheduled',
};
