import { Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { JobNotFoundError } from '@/modules/jobs/job.errors.js';
import { JobService } from '@/modules/jobs/job.service.js';

import type { Job } from '@/modules/jobs/job.js';
import type { Result } from 'neverthrow';

@Injectable()
export class GetJobUseCase {
  constructor(private readonly jobs: JobService) {}
  async execute(id: string): Promise<Result<Job, JobNotFoundError>> {
    const job = await this.jobs.get(id);
    return job ? ok(job) : err(new JobNotFoundError());
  }
}
