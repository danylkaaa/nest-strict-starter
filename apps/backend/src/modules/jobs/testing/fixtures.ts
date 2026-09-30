import type { JobBatchRecord } from '@/modules/jobs/job-batch.js';
import type { JobSummary } from '@/modules/jobs/job.js';

/** Fresh job summary per call; override only the fields a test cares about. */
export const jobSummary = (overrides: Partial<JobSummary> = {}): JobSummary => ({
  attempts: 0,
  batchId: null,
  completedAt: null,
  createdAt: new Date('2030-01-01T00:00:00Z'),
  id: 'f1c0a1d2-0000-4000-8000-000000000001',
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  lastErrorCategory: null,
  maxAttempts: 4,
  payload: { subject: 'Hello' },
  priority: 1,
  queue: 'email',
  result: null,
  startAt: new Date('2030-01-01T00:00:00Z'),
  status: 'pending',
  ...overrides,
});

/** Fresh batch row per call; override only the fields a test cares about. */
export const jobBatchRecord = (overrides: Partial<JobBatchRecord> = {}): JobBatchRecord => ({
  cancellationRequestedAt: null,
  createdAt: new Date('2030-01-01T00:00:00Z'),
  id: 'b1c0a1d2-0000-4000-8000-000000000001',
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  maxAttempts: 4,
  priority: 1,
  startAt: new Date('2030-01-01T00:00:00Z'),
  ...overrides,
});
