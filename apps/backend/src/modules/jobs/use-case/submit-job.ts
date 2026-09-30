import { err, ok } from 'neverthrow';

import { JobConflictError, JobScheduleError } from '@/modules/jobs/job.errors.js';

import type { QueueName } from '@/common/queue/queue.service.js';
import type { CreateJobInput } from '@/modules/jobs/job.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

/**
 * Private to the feature: the submission steps every `Create<Queue>JobUseCase` shares. The key
 * check runs before schedule validation so an identical repeat is always a conflict.
 */
export async function checkSubmission(
  repository: JobRepository,
  input: Pick<CreateJobInput, 'idempotencyKey' | 'startAt' | 'type'>,
): Promise<Result<void, JobConflictError | JobScheduleError>> {
  const existingJobId = await repository.findSubmission(input.idempotencyKey);
  if (existingJobId !== null) return err(new JobConflictError(existingJobId));
  if (input.type === 'schedule' && (!input.startAt || input.startAt.getTime() <= Date.now()))
    return err(new JobScheduleError());
  return ok();
}

export async function enqueueJob(
  repository: JobRepository,
  queue: QueueName,
  input: CreateJobInput,
): Promise<Result<{ id: string; startAt: Date }, JobConflictError>> {
  const result = await repository.create(queue, {
    ...input,
    startAt: input.type === 'schedule' ? input.startAt : undefined,
  });
  return result.duplicate
    ? err(new JobConflictError(result.id))
    : ok({ id: result.id, startAt: result.startAt });
}
