import { describe, expect, it } from 'vitest';

import { JobService } from './job.service.js';
import { fakeJobRepository } from './testing/fake-job.repository.js';
import { jobSummary } from './testing/fixtures.js';

import type { Job } from './job.js';

const row = (queue: Job['queue']) => jobSummary({ queue });

describe('job service', () => {
  it.each(['email', 'webhook', 'aircraft-report'] as const)(
    'reads and cancels a %s job through its own queue',
    async (queue) => {
      const repository = fakeJobRepository();
      repository.getJob.mockResolvedValue(row(queue));
      const service = new JobService(repository);

      await service.get('job-1');
      await service.cancel('job-1');

      expect(repository.getQueueJob).toHaveBeenCalledWith(queue, 'job-1');
      expect(repository.cancelJob).toHaveBeenCalledWith(queue, 'job-1');
    },
  );

  it('reports a missing job when cancelling without touching a queue', async () => {
    const repository = fakeJobRepository();
    await expect(new JobService(repository).cancel('missing')).resolves.toBe('not_found');
    expect(repository.cancelJob).not.toHaveBeenCalled();
  });

  it('rejects direct cancel and manual retry for a batch child without touching the queue', async () => {
    const repository = fakeJobRepository();
    repository.getJob.mockResolvedValue(
      jobSummary({ batchId: 'b1c0a1d2-0000-4000-8000-000000000001', status: 'failed' }),
    );
    const service = new JobService(repository);

    await expect(service.cancel('job-1')).resolves.toBe('not_cancellable');
    await expect(service.retry('job-1')).resolves.toBe('not_retryable');

    expect(repository.cancelJob).not.toHaveBeenCalled();
    expect(repository.retryJob).not.toHaveBeenCalled();
  });

  it('asks the repository to fail a batch child terminally when its batch was cancelled', async () => {
    const repository = fakeJobRepository();
    repository.getJob.mockResolvedValue(
      jobSummary({ batchId: 'b1c0a1d2-0000-4000-8000-000000000001', maxAttempts: 4 }),
    );
    repository.writeJobTransition.mockResolvedValue('failed');

    const outcome = await new JobService(repository).recordFailure(
      'job-1',
      1,
      'delivery_failed',
      false,
    );

    expect(outcome).toEqual({ terminal: true });
    expect(repository.writeJobTransition).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        failedAttemptInCancelledBatch: { attempt: 1, category: 'delivery_failed' },
        status: 'scheduled',
      }),
    );
  });

  it('keeps a batch child retryable when its batch is not cancelled', async () => {
    const repository = fakeJobRepository();
    repository.getJob.mockResolvedValue(
      jobSummary({ batchId: 'b1c0a1d2-0000-4000-8000-000000000001', maxAttempts: 4 }),
    );
    await expect(
      new JobService(repository).recordFailure('job-1', 1, 'delivery_failed', false),
    ).resolves.toEqual({ terminal: false });
  });

  it('reconciles each processing job in its own queue', async () => {
    const repository = fakeJobRepository();
    repository.listProcessingJobs.mockResolvedValue([
      { id: 'a', queue: 'webhook' },
      { id: 'b', queue: 'aircraft-report' },
    ]);
    repository.getQueueJob
      .mockResolvedValueOnce({ retryCount: 0, startAfter: new Date(), state: 'retry' })
      .mockResolvedValueOnce({ retryCount: 3, startAfter: new Date(), state: 'failed' });

    await new JobService(repository).reconcileProcessing();

    expect(repository.getQueueJob).toHaveBeenCalledWith('webhook', 'a');
    expect(repository.getQueueJob).toHaveBeenCalledWith('aircraft-report', 'b');
    expect(repository.writeJobTransition).toHaveBeenCalledTimes(2);
  });

  it.each([
    { attempt: 1, events: ['attempt_failed', 'failed'], maxAttempts: 1, status: 'failed' },
    { attempt: 1, events: ['attempt_failed'], maxAttempts: 2, status: 'scheduled' },
    { attempt: 2, events: ['attempt_failed', 'failed'], maxAttempts: 2, status: 'failed' },
    { attempt: 4, events: ['attempt_failed', 'failed'], maxAttempts: 4, status: 'failed' },
    { attempt: 5, events: ['attempt_failed', 'failed'], maxAttempts: 5, status: 'failed' },
    { attempt: 4, events: ['attempt_failed'], maxAttempts: 5, status: 'scheduled' },
  ])(
    'records attempt $attempt of $maxAttempts as $status',
    async ({ attempt, events, maxAttempts, status }) => {
      const repository = fakeJobRepository();
      repository.getJob.mockResolvedValue(jobSummary({ maxAttempts }));

      const outcome = await new JobService(repository).recordFailure(
        'job-1',
        attempt,
        'delivery_failed',
        false,
      );

      expect(outcome).toEqual({ terminal: status === 'failed' });
      expect(repository.writeJobTransition).toHaveBeenCalledWith('job-1', {
        logs: events.map((event) =>
          expect.objectContaining({ attempt, errorCategory: 'delivery_failed', event }),
        ),
        status,
      });
    },
  );

  it('ends the job at once for a dead-lettered input error', async () => {
    const repository = fakeJobRepository();
    repository.getJob.mockResolvedValue(jobSummary({ maxAttempts: 4 }));
    await expect(
      new JobService(repository).recordFailure('job-1', 1, 'invalid_payload', true),
    ).resolves.toEqual({ terminal: true });
  });

  it('re-reads the job after reconciling so derived figures are current', async () => {
    const repository = fakeJobRepository();
    repository.getJob
      .mockResolvedValueOnce(jobSummary({ status: 'processing' }))
      .mockResolvedValue(jobSummary({ attempts: 1, completedAt: new Date(), status: 'failed' }));
    repository.getQueueJob.mockResolvedValue({
      retryCount: 0,
      startAfter: new Date(),
      state: 'failed',
    });

    const job = await new JobService(repository).get('job-1');

    expect(repository.setJobStatus).toHaveBeenCalledWith('job-1', 'failed');
    expect(job).toMatchObject({ attempts: 1, status: 'failed' });
    expect(job?.completedAt).toBeInstanceOf(Date);
  });

  it('skips a claimed batch child when cancellation was already requested', async () => {
    const repository = fakeJobRepository();
    repository.writeJobTransition.mockResolvedValue('failed');

    await expect(new JobService(repository).recordStart('job-1', 2)).resolves.toBe(false);
    expect(repository.writeJobTransition).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ skipIfBatchCancelled: { attempt: 2 }, status: 'processing' }),
    );
  });

  it('stores the result object on completion', async () => {
    const repository = fakeJobRepository();
    await new JobService(repository).recordCompletion('job-1', 2, { webhookCallId: 'whc_1' });
    expect(repository.writeJobTransition).toHaveBeenCalledWith('job-1', {
      logs: [{ attempt: 2, event: 'completed', eventKey: 'completed' }],
      result: { webhookCallId: 'whc_1' },
      status: 'completed',
    });
  });
});
