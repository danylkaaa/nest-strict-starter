import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { toJobBatch } from '@/modules/jobs/job-batch.js';
import { JobBatchNotFoundError } from '@/modules/jobs/job.errors.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobBatch } from '@/modules/jobs/job-batch.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class GetJobBatchUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async execute(id: string): Promise<Result<JobBatch, JobBatchNotFoundError>> {
    const found = await this.repository.getJobBatch(id);
    return found
      ? ok(toJobBatch(found.batch, found.children, new Date()))
      : err(new JobBatchNotFoundError());
  }
}
