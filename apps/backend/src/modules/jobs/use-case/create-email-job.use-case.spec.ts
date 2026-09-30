import { err } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';

import { CreateEmailJobUseCase } from './create-email-job.use-case.js';

const input = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  maxAttempts: 4,
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

  it('passes the chosen maxAttempts to the repository', async () => {
    const repository = fakeJobRepository();
    await new CreateEmailJobUseCase(repository).execute({ ...input, maxAttempts: 2 });
    expect(repository.create).toHaveBeenCalledWith(
      'email',
      expect.objectContaining({ maxAttempts: 2 }),
    );
  });

  it('reports a used key as a conflict carrying the existing job ID', async () => {
    const repository = fakeJobRepository();
    repository.findSubmission.mockResolvedValue('job-0');
    const result = await new CreateEmailJobUseCase(repository).execute(input);
    expect(result).toEqual(
      err(expect.objectContaining({ existingJobId: 'job-0', name: 'JobConflictError' })),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
});
