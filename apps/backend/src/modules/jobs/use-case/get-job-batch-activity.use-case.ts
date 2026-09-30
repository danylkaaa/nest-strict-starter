import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { buildBatchActivity } from '@/modules/jobs/job-batch.js';
import { JobBatchNotFoundError } from '@/modules/jobs/job.errors.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobBatchActivityEntry } from '@/modules/jobs/job-batch.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class GetJobBatchActivityUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async execute(id: string): Promise<Result<JobBatchActivityEntry[], JobBatchNotFoundError>> {
    const found = await this.repository.getJobBatchActivity(id);
    return found
      ? ok(buildBatchActivity(found.batch, found.rows))
      : err(new JobBatchNotFoundError());
  }
}
