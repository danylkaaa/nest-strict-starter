import { vi } from 'vitest';

import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

/** Fresh repository fake per test: no submissions exist and creation succeeds. */
export const fakeJobRepository = (): {
  [K in keyof JobRepository]: ReturnType<typeof vi.fn<JobRepository[K]>>;
} => ({
  addJobLog: vi.fn<JobRepository['addJobLog']>().mockResolvedValue(),
  cancelJob: vi.fn<JobRepository['cancelJob']>().mockResolvedValue('cancelled'),
  cancelJobBatch: vi.fn<JobRepository['cancelJobBatch']>().mockResolvedValue('cancelled'),
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
  createBatch: vi.fn<JobRepository['createBatch']>().mockResolvedValue({
    duplicate: false,
    id: 'batch-1',
    startAt: new Date('2030-01-01T00:00:00Z'),
  }),
  findBatchSubmission: vi.fn<JobRepository['findBatchSubmission']>().mockResolvedValue(null),
  findSubmission: vi.fn<JobRepository['findSubmission']>().mockResolvedValue(null),
  getJob: vi.fn<JobRepository['getJob']>().mockResolvedValue(null),
  getJobActivity: vi.fn<JobRepository['getJobActivity']>().mockResolvedValue([]),
  getJobBatch: vi.fn<JobRepository['getJobBatch']>().mockResolvedValue(null),
  getQueueJob: vi.fn<JobRepository['getQueueJob']>().mockResolvedValue(null),
  isHealthy: vi.fn<JobRepository['isHealthy']>().mockResolvedValue(true),
  listJobBatches: vi
    .fn<JobRepository['listJobBatches']>()
    .mockResolvedValue({ items: [], total: 0 }),
  listJobs: vi.fn<JobRepository['listJobs']>().mockResolvedValue({ items: [], total: 0 }),
  listProcessingJobs: vi.fn<JobRepository['listProcessingJobs']>().mockResolvedValue([]),
  retryJob: vi.fn<JobRepository['retryJob']>().mockResolvedValue('retried'),
  setJobStatus: vi.fn<JobRepository['setJobStatus']>().mockResolvedValue(),
  writeJobTransition: vi
    .fn<JobRepository['writeJobTransition']>()
    .mockImplementation((_id, transition) => Promise.resolve(transition.status)),
});
