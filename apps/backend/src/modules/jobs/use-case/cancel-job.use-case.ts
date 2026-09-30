import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { JobNotCancellableError, JobNotFoundError } from '@/modules/jobs/job.errors.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class CancelJobUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}
  async execute(
    id: string,
  ): Promise<
    Result<{ id: string; status: 'cancelled' }, JobNotFoundError | JobNotCancellableError>
  > {
    const result = await this.repository.cancel(id);
    if (result === 'not_found') return err(new JobNotFoundError());
    if (result === 'not_cancellable') return err(new JobNotCancellableError());
    return ok({ id, status: 'cancelled' });
  }
}
