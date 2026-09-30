import { Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { JobNotCancellableError, JobNotFoundError } from '@/modules/jobs/job.errors.js';
import { JobService } from '@/modules/jobs/job.service.js';

import type { Result } from 'neverthrow';

@Injectable()
export class CancelJobUseCase {
  constructor(private readonly jobs: JobService) {}
  async execute(
    id: string,
  ): Promise<
    Result<{ id: string; status: 'cancelled' }, JobNotFoundError | JobNotCancellableError>
  > {
    const result = await this.jobs.cancel(id);
    if (result === 'not_found') return err(new JobNotFoundError());
    if (result === 'not_cancellable') return err(new JobNotCancellableError());
    return ok({ id, status: 'cancelled' });
  }
}
