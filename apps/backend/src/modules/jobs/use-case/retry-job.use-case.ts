import { Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { JobNotFoundError, JobNotRetryableError } from '@/modules/jobs/job.errors.js';
import { JobService } from '@/modules/jobs/job.service.js';

import type { Job } from '@/modules/jobs/job.js';
import type { Result } from 'neverthrow';

@Injectable()
export class RetryJobUseCase {
  constructor(private readonly jobs: JobService) {}

  async execute(id: string): Promise<Result<Job, JobNotFoundError | JobNotRetryableError>> {
    const outcome = await this.jobs.retry(id);
    if (outcome === 'not_found') return err(new JobNotFoundError());
    if (outcome === 'not_retryable') return err(new JobNotRetryableError());
    const job = await this.jobs.get(id);
    return job ? ok(job) : err(new JobNotFoundError());
  }
}
