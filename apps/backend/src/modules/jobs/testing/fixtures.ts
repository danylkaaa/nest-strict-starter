import type { JobSummary } from '@/modules/jobs/job.js';

/** Fresh job summary per call; override only the fields a test cares about. */
export const jobSummary = (overrides: Partial<JobSummary> = {}): JobSummary => ({
  attempts: 0,
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
