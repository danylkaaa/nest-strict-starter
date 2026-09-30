import { describe, expect, it } from 'vitest';

import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';

import { GetJobStatsUseCase } from './get-job-stats.use-case.js';

const counts = {
  cancelled: 0,
  completed: 4,
  failed: 1,
  pending: 2,
  processing: 0,
  scheduled: 3,
};

describe('get job stats use case', () => {
  it('returns the status counts and the queue health', async () => {
    const repository = fakeJobRepository();
    repository.countJobsByStatus.mockResolvedValue(counts);
    repository.isHealthy.mockResolvedValue(true);
    await expect(new GetJobStatsUseCase(repository).execute()).resolves.toEqual({
      counts,
      healthy: true,
    });
  });

  it('reports unhealthy when the repository cannot reach its dependencies', async () => {
    const repository = fakeJobRepository();
    repository.countJobsByStatus.mockResolvedValue(counts);
    repository.isHealthy.mockResolvedValue(false);
    const stats = await new GetJobStatsUseCase(repository).execute();
    expect(stats.healthy).toBe(false);
  });
});
