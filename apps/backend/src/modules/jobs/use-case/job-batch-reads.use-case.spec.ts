import { err, ok } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { JobBatchNotCancellableError, JobBatchNotFoundError } from '@/modules/jobs/job.errors.js';
import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';
import { jobBatchRecord, jobSummary } from '@/modules/jobs/testing/fixtures.js';

import { CancelJobBatchUseCase } from './cancel-job-batch.use-case.js';
import { GetJobBatchUseCase } from './get-job-batch.use-case.js';
import { ListJobBatchesUseCase } from './list-job-batches.use-case.js';

const past = new Date('2020-01-01T00:00:00Z');
const children = [
  { job: jobSummary({ id: 'a', status: 'completed' }), position: 1 },
  { job: jobSummary({ id: 'b', status: 'processing' }), position: 2 },
  { job: jobSummary({ id: 'c', queue: 'webhook', status: 'pending' }), position: 3 },
];

describe('get job batch use case', () => {
  it('returns ordered children with counts, progress, and the derived status', async () => {
    const repository = fakeJobRepository();
    repository.getJobBatch.mockResolvedValue({
      batch: jobBatchRecord({ startAt: past }),
      children,
    });
    const result = await new GetJobBatchUseCase(repository).execute('b-1');
    expect(result).toEqual(
      ok(
        expect.objectContaining({
          counts: expect.objectContaining({ completed: 1, pending: 1, processing: 1 }),
          items: [
            expect.objectContaining({ position: 1 }),
            expect.objectContaining({ position: 2 }),
            expect.objectContaining({ position: 3 }),
          ],
          progress: 33,
          status: 'processing',
          total: 3,
        }),
      ),
    );
  });

  it('reports an unknown batch', async () => {
    const result = await new GetJobBatchUseCase(fakeJobRepository()).execute('missing');
    expect(result).toEqual(err(new JobBatchNotFoundError()));
  });
});

describe('list job batches use case', () => {
  it('derives each batch from its children and the page figures', async () => {
    const repository = fakeJobRepository();
    repository.listJobBatches.mockResolvedValue({
      items: [
        { batch: jobBatchRecord({ id: 'x', startAt: past }), children: [] },
        {
          batch: jobBatchRecord({ id: 'y', startAt: past }),
          children: [
            { attempts: 1, status: 'completed' },
            { attempts: 4, status: 'failed' },
          ],
        },
      ],
      total: 21,
    });
    const page = await new ListJobBatchesUseCase(repository).execute({ page: 2, pageSize: 10 });
    expect(repository.listJobBatches).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
    expect(page).toMatchObject({ page: 2, pageSize: 10, total: 21, totalPages: 3 });
    expect(page.items[1]).toMatchObject({
      id: 'y',
      progress: 100,
      status: 'completed_with_errors',
    });
  });
});

describe('cancel job batch use case', () => {
  it('returns the current batch after a cancellation request', async () => {
    const repository = fakeJobRepository();
    repository.getJobBatch.mockResolvedValue({
      batch: jobBatchRecord({ cancellationRequestedAt: past, startAt: past }),
      children: [{ job: jobSummary({ status: 'processing' }), position: 1 }],
    });
    const result = await new CancelJobBatchUseCase(repository).execute('b-1');
    expect(repository.cancelJobBatch).toHaveBeenCalledWith('b-1');
    expect(result).toEqual(ok(expect.objectContaining({ status: 'cancelling' })));
  });

  it('returns the batch unchanged for a repeated request', async () => {
    const repository = fakeJobRepository();
    repository.cancelJobBatch.mockResolvedValue('already_requested');
    repository.getJobBatch.mockResolvedValue({
      batch: jobBatchRecord({ cancellationRequestedAt: past, startAt: past }),
      children: [{ job: jobSummary({ status: 'cancelled' }), position: 1 }],
    });
    const result = await new CancelJobBatchUseCase(repository).execute('b-1');
    expect(result).toEqual(ok(expect.objectContaining({ status: 'cancelled' })));
  });

  it('reports an unknown batch and a finished uncancelled batch', async () => {
    const repository = fakeJobRepository();
    repository.cancelJobBatch.mockResolvedValueOnce('not_found');
    const missing = await new CancelJobBatchUseCase(repository).execute('x');
    expect(missing).toEqual(err(new JobBatchNotFoundError()));
    repository.cancelJobBatch.mockResolvedValueOnce('not_cancellable');
    const finished = await new CancelJobBatchUseCase(repository).execute('x');
    expect(finished).toEqual(err(new JobBatchNotCancellableError()));
    expect(repository.getJobBatch).not.toHaveBeenCalled();
  });
});
