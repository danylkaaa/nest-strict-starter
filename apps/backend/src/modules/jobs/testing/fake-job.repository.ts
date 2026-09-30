import { vi } from 'vitest';

import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

/** Fresh repository fake per test: no submissions exist and creation succeeds. */
export const fakeJobRepository = (): {
  [K in keyof JobRepository]: ReturnType<typeof vi.fn<JobRepository[K]>>;
} => ({
  addJobLog: vi.fn<JobRepository['addJobLog']>().mockResolvedValue(),
  cancelJob: vi.fn<JobRepository['cancelJob']>().mockResolvedValue('cancelled'),
  countJobsByStatus: vi.fn<JobRepository['countJobsByStatus']>().mockResolvedValue({
    cancelled: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    scheduled: 0,
  }),
  create: vi.fn<JobRepository['create']>().mockResolvedValue({
    duplicate: false,
    id: 'job-1',
    startAt: new Date('2030-01-01T00:00:00Z'),
  }),
  findSubmission: vi.fn<JobRepository['findSubmission']>().mockResolvedValue(null),
  getJob: vi.fn<JobRepository['getJob']>().mockResolvedValue(null),
  getJobActivity: vi.fn<JobRepository['getJobActivity']>().mockResolvedValue([]),
  getQueueJob: vi.fn<JobRepository['getQueueJob']>().mockResolvedValue(null),
  isHealthy: vi.fn<JobRepository['isHealthy']>().mockResolvedValue(true),
  listJobs: vi.fn<JobRepository['listJobs']>().mockResolvedValue({ items: [], total: 0 }),
  listProcessingJobs: vi.fn<JobRepository['listProcessingJobs']>().mockResolvedValue([]),
  retryJob: vi.fn<JobRepository['retryJob']>().mockResolvedValue('retried'),
  setJobStatus: vi.fn<JobRepository['setJobStatus']>().mockResolvedValue(),
  writeJobTransition: vi.fn<JobRepository['writeJobTransition']>().mockResolvedValue(),
});
