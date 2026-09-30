import { COARSE_STATUS } from './job-rules';

import type { BatchStatus, Job, JobStatus } from './job';

// Builders for spec files: a fresh job per call, overriding only what a test cares about

const base = {
  attemptHistory: [],
  attempts: 0,
  batchId: null,
  completedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  error: null,
  id: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  logs: [],
  maxAttempts: 4,
  priority: 3,
  progress: 0,
  runAt: null,
  startedAt: null,
  workerId: null,
};

export const emailJob = (status: JobStatus, batchId: string | null = null): Job => ({
  ...base,
  batchId,
  payload: { body: 'Hello', subject: 'Hi', to: 'a@example.com' },
  result: null,
  status,
  type: 'email',
});

export const batchJob = (batchStatus: BatchStatus): Job => ({
  ...base,
  batchChildIds: [],
  batchItems: [],
  batchStatus,
  payload: { items: [] },
  result: null,
  status: COARSE_STATUS[batchStatus],
  type: 'batch',
});
