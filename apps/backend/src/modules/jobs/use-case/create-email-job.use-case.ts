import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { JobConflictError, JobScheduleError } from '@/modules/jobs/job.errors.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { CreateEmailJobInput } from '@/modules/jobs/job.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class CreateEmailJobUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async execute(
    input: CreateEmailJobInput,
  ): Promise<Result<{ id: string; startAt: Date }, JobConflictError | JobScheduleError>> {
    if (await this.repository.hasSubmission(input.idempotencyKey))
      return err(new JobConflictError());
    if (input.type === 'schedule' && (!input.startAt || input.startAt.getTime() <= Date.now()))
      return err(new JobScheduleError());
    const result = await this.repository.create({
      ...input,
      startAt: input.type === 'schedule' ? input.startAt : undefined,
    });
    return result.duplicate
      ? err(new JobConflictError())
      : ok({ id: result.id, startAt: result.startAt });
  }
}
