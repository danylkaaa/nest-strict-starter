import { err } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { JobConflictError, JobScheduleError } from '@/modules/jobs/job.errors.js';
import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';

import { CreateWebhookJobUseCase } from './create-webhook-job.use-case.js';

const input = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  maxAttempts: 4,
  payload: { method: 'POST', payload: { hello: 'world' }, url: 'https://example.com/hook' },
  priority: 3,
  type: 'instant',
} as const;

describe('create webhook job use case', () => {
  it('enqueues on the webhook queue', async () => {
    const repository = fakeJobRepository();
    const result = await new CreateWebhookJobUseCase(repository).execute(input);
    expect(result.isOk()).toBe(true);
    expect(repository.create).toHaveBeenCalledWith('webhook', {
      ...input,
      startAt: undefined,
    });
  });

  it('reports a used key as a conflict before checking the schedule', async () => {
    const repository = fakeJobRepository();
    repository.findSubmission.mockResolvedValue('job-0');
    const result = await new CreateWebhookJobUseCase(repository).execute({
      ...input,
      startAt: new Date(Date.now() - 1000),
      type: 'schedule',
    });
    expect(result).toEqual(err(expect.any(JobConflictError)));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a scheduled job without a future start', async () => {
    const repository = fakeJobRepository();
    const result = await new CreateWebhookJobUseCase(repository).execute({
      ...input,
      startAt: new Date(Date.now() - 1000),
      type: 'schedule',
    });
    expect(result).toEqual(err(expect.any(JobScheduleError)));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('reports a concurrent duplicate found by the repository as a conflict', async () => {
    const repository = fakeJobRepository();
    repository.create.mockResolvedValue({ duplicate: true, id: 'job-0', startAt: new Date() });
    const result = await new CreateWebhookJobUseCase(repository).execute(input);
    expect(result).toEqual(
      err(expect.objectContaining({ existingJobId: 'job-0', name: 'JobConflictError' })),
    );
  });
});
