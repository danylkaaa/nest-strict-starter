import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { JobNotFoundError } from '@/modules/jobs/job.errors.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { EmailJob } from '@/modules/jobs/job.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class GetJobUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}
  async execute(id: string): Promise<Result<EmailJob, JobNotFoundError>> {
    const job = await this.repository.get(id);
    return job ? ok(job) : err(new JobNotFoundError());
  }
}
