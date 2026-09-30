import { describe, expect, it } from 'vitest';

import { JobService } from './job.service.js';
import { fakeJobRepository } from './testing/fake-job.repository.js';

import type { Job } from './job.js';

const row = (queue: Job['queue']): Omit<Job, 'activity'> => ({
  id: 'job-1',
  priority: 1,
  queue,
  result: null,
  startAt: new Date('2030-01-01T00:00:00Z'),
  status: 'pending',
});

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
