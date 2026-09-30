import { err, ok } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { JobNotFoundError, JobNotRetryableError } from '@/modules/jobs/job.errors.js';
import { JobService } from '@/modules/jobs/job.service.js';
import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';
import { jobSummary } from '@/modules/jobs/testing/fixtures.js';

import { RetryJobUseCase } from './retry-job.use-case.js';

const past = new Date('2020-01-01T00:00:00Z');
const failedInQueue = { retryCount: 3, startAfter: past, state: 'failed' };
const retryInQueue = { retryCount: 3, startAfter: past, state: 'retry' };

const setup = () => {
  const repository = fakeJobRepository();
  return { repository, useCase: new RetryJobUseCase(new JobService(repository)) };
};

describe('retry job use case', () => {
  it('retries a failed job in its own queue and returns the job as pending', async () => {
    const { repository, useCase } = setup();
    // Each read is a reconciling get: stored row, then re-read; the second get follows the retry.
    repository.getJob
      .mockResolvedValueOnce(jobSummary({ queue: 'webhook', status: 'failed' }))
      .mockResolvedValueOnce(jobSummary({ queue: 'webhook', status: 'failed' }))
      .mockResolvedValue(jobSummary({ maxAttempts: 5, queue: 'webhook', status: 'pending' }));
    repository.getQueueJob.mockResolvedValueOnce(failedInQueue).mockResolvedValue(retryInQueue);

    const result = await useCase.execute('job-1');

    expect(repository.retryJob).toHaveBeenCalledWith('webhook', 'job-1');
    expect(result).toEqual(ok(expect.objectContaining({ maxAttempts: 5, status: 'pending' })));
  });

  it('reports an unknown job', async () => {
    const { repository, useCase } = setup();
    await expect(useCase.execute('missing')).resolves.toEqual(err(expect.any(JobNotFoundError)));
    expect(repository.retryJob).not.toHaveBeenCalled();
  });

  it('refuses a job that has not failed', async () => {
    const { repository, useCase } = setup();
    repository.getJob.mockResolvedValue(jobSummary({ status: 'pending' }));
    await expect(useCase.execute('job-1')).resolves.toEqual(err(expect.any(JobNotRetryableError)));
    expect(repository.retryJob).not.toHaveBeenCalled();
  });

  it('refuses when the repository finds the job no longer failed', async () => {
    const { repository, useCase } = setup();
    repository.getJob.mockResolvedValue(jobSummary({ status: 'failed' }));
    repository.getQueueJob.mockResolvedValue(failedInQueue);
    repository.retryJob.mockResolvedValue('not_retryable');
    await expect(useCase.execute('job-1')).resolves.toEqual(err(expect.any(JobNotRetryableError)));
  });

  it('reconciles a stale processing row to failed before retrying', async () => {
    const { repository, useCase } = setup();
    repository.getJob.mockResolvedValue(jobSummary({ status: 'processing' }));
    repository.getQueueJob.mockResolvedValue(failedInQueue);
    await useCase.execute('job-1');
    expect(repository.setJobStatus).toHaveBeenCalledWith('job-1', 'failed');
    expect(repository.retryJob).toHaveBeenCalledWith('email', 'job-1');
  });
});
