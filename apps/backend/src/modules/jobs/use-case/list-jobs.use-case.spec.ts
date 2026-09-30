import { describe, expect, it } from 'vitest';

import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';
import { jobSummary } from '@/modules/jobs/testing/fixtures.js';

import { ListJobsUseCase } from './list-jobs.use-case.js';

describe('list jobs use case', () => {
  it('passes the filters to the repository and derives the page figures', async () => {
    const repository = fakeJobRepository();
    const items = [jobSummary({ id: 'a' }), jobSummary({ id: 'b' })];
    repository.listJobs.mockResolvedValue({ items, total: 25 });

    const result = await new ListJobsUseCase(repository).execute({
      page: 2,
      pageSize: 10,
      queue: 'webhook',
      search: 'abc',
      statuses: ['failed', 'pending'],
    });

    expect(repository.listJobs).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      queue: 'webhook',
      search: 'abc',
      statuses: ['failed', 'pending'],
    });
    expect(result).toEqual({ items, page: 2, pageSize: 10, total: 25, totalPages: 3 });
  });

  it('reports one page for an empty result', async () => {
    const repository = fakeJobRepository();
    repository.listJobs.mockResolvedValue({ items: [], total: 0 });
    const result = await new ListJobsUseCase(repository).execute({ page: 1, pageSize: 10 });
    expect(result).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  });
});
