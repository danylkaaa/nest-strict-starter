import { describe, expect, it } from 'vitest';

import { BATCH_STATUSES } from './job';
import { batchJob, emailJob } from './job-fixtures';
import {
  canCancel,
  canRetry,
  COARSE_STATUS,
  displayStatus,
  jobPath,
  STATUS_LABEL,
  toRerunInput,
} from './job-rules';

const CHILD_OF = '33333333-3333-4333-8333-333333333333';

describe('toRerunInput', () => {
  const KEY = '44444444-4444-4444-8444-444444444444';

  it('copies the body and limits of a finished job under a fresh key, run now', () => {
    const job = emailJob('completed');
    const input = toRerunInput(job, KEY);

    expect(input).toEqual({
      idempotencyKey: KEY,
      maxAttempts: job.maxAttempts,
      payload: job.payload,
      priority: job.priority,
      type: 'email',
    });
    expect(input.runAt).toBeUndefined();
  });

  it('runs a batch child as a standalone job', () => {
    expect(toRerunInput(emailJob('failed', CHILD_OF), KEY)).toMatchObject({ type: 'email' });
  });

  it('copies the tasks of a batch', () => {
    expect(toRerunInput(batchJob('completed'), KEY)).toMatchObject({
      payload: { items: [] },
      type: 'batch',
    });
  });
});

describe('job rules', () => {
  it('allows cancelling jobs that have not started', () => {
    expect(canCancel(emailJob('scheduled'))).toBe(true);
    expect(canCancel(emailJob('pending'))).toBe(true);
  });

  it('refuses to cancel running or finished standalone jobs', () => {
    expect(canCancel(emailJob('processing'))).toBe(false);
    expect(canCancel(emailJob('completed'))).toBe(false);
  });

  it.each(['scheduled', 'pending', 'processing'] as const)(
    'allows cancelling a %s batch',
    (status) => {
      expect(canCancel(batchJob(status))).toBe(true);
    },
  );

  it.each(['cancelling', 'cancelled', 'completed', 'completed_with_errors'] as const)(
    'refuses to cancel a %s batch',
    (status) => {
      expect(canCancel(batchJob(status))).toBe(false);
    },
  );

  it('hides cancel and retry for a batch child, which the API blocks', () => {
    expect(canCancel(emailJob('pending', CHILD_OF))).toBe(false);
    expect(canRetry(emailJob('failed', CHILD_OF))).toBe(false);
  });

  it('allows retrying failed standalone jobs only', () => {
    expect(canRetry(emailJob('failed'))).toBe(true);
    expect(canRetry(emailJob('completed'))).toBe(false);
    expect(canRetry(batchJob('completed_with_errors'))).toBe(false);
  });
});

describe('status display', () => {
  it('shows a batch its own derived status and a job its job status', () => {
    expect(displayStatus(batchJob('cancelling'))).toBe('cancelling');
    expect(displayStatus(batchJob('completed_with_errors'))).toBe('completed_with_errors');
    expect(displayStatus(emailJob('failed'))).toBe('failed');
  });

  it('labels every batch status and maps it to a job status for filters', () => {
    for (const status of BATCH_STATUSES) expect(STATUS_LABEL[status]).not.toBe('');
    expect(COARSE_STATUS.cancelling).toBe('processing');
    expect(COARSE_STATUS.completed_with_errors).toBe('failed');
  });

  it('routes a batch to its own page', () => {
    expect(jobPath(batchJob('pending'))).toBe('/batches/11111111-1111-4111-8111-111111111111');
    expect(jobPath(emailJob('pending'))).toBe('/jobs/11111111-1111-4111-8111-111111111111');
  });
});
