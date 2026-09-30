import { err } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { JobConflictError } from '@/modules/jobs/job.errors.js';
import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';

import { CreateEmailJobUseCase } from './create-email-job.use-case.js';

const input = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  payload: { body: 'Hello', recipient: 'person@example.com', subject: 'Welcome' },
  priority: 3,
  type: 'instant',
} as const;

describe('create email job use case', () => {
  it('enqueues on the email queue and ignores startAt for instant jobs', async () => {
    const repository = fakeJobRepository();
    const result = await new CreateEmailJobUseCase(repository).execute({
      ...input,
      startAt: new Date('2031-01-01T00:00:00Z'),
    });
    expect(result.isOk()).toBe(true);
    expect(repository.create).toHaveBeenCalledWith('email', { ...input, startAt: undefined });
  });

  it('reports a used key as a conflict', async () => {
    const repository = fakeJobRepository();
    repository.hasSubmission.mockResolvedValue(true);
    const result = await new CreateEmailJobUseCase(repository).execute(input);
    expect(result).toEqual(err(expect.any(JobConflictError)));
    expect(repository.create).not.toHaveBeenCalled();
  });
});
