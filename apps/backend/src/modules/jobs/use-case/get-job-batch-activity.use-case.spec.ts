import { err } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { JobBatchNotFoundError } from '@/modules/jobs/job.errors.js';
import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';
import { jobBatchRecord } from '@/modules/jobs/testing/fixtures.js';

import { GetJobBatchActivityUseCase } from './get-job-batch-activity.use-case.js';

import type { JobBatchActivityRow } from '@/modules/jobs/job-batch.js';

const at = (seconds: number): Date => new Date(Date.UTC(2030, 0, 1, 0, 0, seconds));

const row = (overrides: Partial<JobBatchActivityRow>): JobBatchActivityRow => ({
  attempt: null,
  errorCategory: null,
  event: 'created',
  id: 'jac_1',
  jobId: 'job-a',
  position: 1,
  queue: 'email',
  recordedAt: at(0),
  ...overrides,
});

const setup = (
  batchOverrides: Parameters<typeof jobBatchRecord>[0],
  rows: JobBatchActivityRow[],
) => {
  const repository = fakeJobRepository();
  repository.getJobBatchActivity.mockResolvedValue({
    batch: jobBatchRecord({ id: 'batch-1', ...batchOverrides }),
    rows,
  });
  return { repository, useCase: new GetJobBatchActivityUseCase(repository) };
};

describe('get job batch activity use case', () => {
  it('returns the batch-created entry first, then child events oldest first tagged with position', async () => {
    const { repository, useCase } = setup({ createdAt: at(0) }, [
      row({
        attempt: 1,
        event: 'started',
        id: 'jac_3',
        jobId: 'job-b',
        position: 2,
        queue: 'webhook',
        recordedAt: at(5),
      }),
      row({ id: 'jac_1', jobId: 'job-a', position: 1, recordedAt: at(1) }),
      row({ id: 'jac_2', jobId: 'job-b', position: 2, queue: 'webhook', recordedAt: at(2) }),
    ]);

    const result = await useCase.execute('batch-1');

    expect(repository.getJobBatchActivity).toHaveBeenCalledWith('batch-1');
    expect(result.unwrapOr([])).toEqual([
      {
        attempt: null,
        errorCategory: null,
        event: 'batch_created',
        id: 'batch_created:batch-1',
        jobId: null,
        position: null,
        queue: null,
        recordedAt: at(0),
      },
      expect.objectContaining({ event: 'created', jobId: 'job-a', position: 1, queue: 'email' }),
      expect.objectContaining({ event: 'created', jobId: 'job-b', position: 2, queue: 'webhook' }),
      expect.objectContaining({ attempt: 1, event: 'started', jobId: 'job-b', position: 2 }),
    ]);
  });

  it('breaks ties by kind, then position, then id, independent of input order', async () => {
    const { useCase } = setup({ cancellationRequestedAt: at(3), createdAt: at(3) }, [
      row({ id: 'jac_b', jobId: 'job-b', position: 2, recordedAt: at(3) }),
      row({ event: 'cancelled', id: 'jac_z', position: 1, recordedAt: at(3) }),
      row({ id: 'jac_a', position: 1, recordedAt: at(3) }),
    ]);

    const result = await useCase.execute('batch-1');

    expect(result.unwrapOr([]).map((entry) => entry.id)).toEqual([
      'batch_created:batch-1',
      'cancellation_requested:batch-1',
      'jac_a',
      'jac_z',
      'jac_b',
    ]);
  });

  it('adds a cancellation-requested entry at that time only when it is set', async () => {
    const withRequest = await setup({ cancellationRequestedAt: at(9), createdAt: at(0) }, [
      row({ recordedAt: at(1) }),
    ]).useCase.execute('batch-1');
    expect(withRequest.unwrapOr([]).map((entry) => entry.event)).toEqual([
      'batch_created',
      'created',
      'cancellation_requested',
    ]);

    const without = await setup({ createdAt: at(0) }, []).useCase.execute('batch-1');
    expect(without.unwrapOr([]).map((entry) => entry.event)).toEqual(['batch_created']);
  });

  it('reports an unknown batch', async () => {
    const result = await new GetJobBatchActivityUseCase(fakeJobRepository()).execute('missing');
    expect(result).toEqual(err(new JobBatchNotFoundError()));
  });
});
