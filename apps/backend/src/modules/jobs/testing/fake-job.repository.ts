import { vi } from 'vitest';

import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

/** Fresh repository fake per test: no submissions exist and creation succeeds. */
export const fakeJobRepository = (): {
  [K in keyof JobRepository]: ReturnType<typeof vi.fn<JobRepository[K]>>;
} => ({
  addJobLog: vi.fn<JobRepository['addJobLog']>().mockResolvedValue(),
  cancelJob: vi.fn<JobRepository['cancelJob']>().mockResolvedValue('cancelled'),
  create: vi.fn<JobRepository['create']>().mockResolvedValue({
    duplicate: false,
    id: 'job-1',
    startAt: new Date('2030-01-01T00:00:00Z'),
  }),
  getJob: vi.fn<JobRepository['getJob']>().mockResolvedValue(null),
  getJobActivity: vi.fn<JobRepository['getJobActivity']>().mockResolvedValue([]),
  getQueueJob: vi.fn<JobRepository['getQueueJob']>().mockResolvedValue(null),
  hasSubmission: vi.fn<JobRepository['hasSubmission']>().mockResolvedValue(false),
  listProcessingJobs: vi.fn<JobRepository['listProcessingJobs']>().mockResolvedValue([]),
  setJobStatus: vi.fn<JobRepository['setJobStatus']>().mockResolvedValue(),
  writeJobTransition: vi.fn<JobRepository['writeJobTransition']>().mockResolvedValue(),
});
