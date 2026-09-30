import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { toJobBatch } from '@/modules/jobs/job-batch.js';
import { JobBatchNotCancellableError, JobBatchNotFoundError } from '@/modules/jobs/job.errors.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobBatch } from '@/modules/jobs/job-batch.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class CancelJobBatchUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  /**
   * Requests cancellation once and returns the current batch. A repeated request returns the
   * batch unchanged; a finished batch that was never cancelled cannot be cancelled.
   */
  async execute(
    id: string,
  ): Promise<Result<JobBatch, JobBatchNotFoundError | JobBatchNotCancellableError>> {
    const outcome = await this.repository.cancelJobBatch(id);
    if (outcome === 'not_found') return err(new JobBatchNotFoundError());
    if (outcome === 'not_cancellable') return err(new JobBatchNotCancellableError());
    const found = await this.repository.getJobBatch(id);
    if (!found) return err(new JobBatchNotFoundError());
    return ok(toJobBatch(found.batch, found.children, new Date()));
  }
}
