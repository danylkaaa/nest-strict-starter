import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobStatus } from '@/modules/jobs/job.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

/** Counts per effective status from the database alone; it never touches the queue. */
@Injectable()
export class CountJobsByStatusUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async execute(): Promise<Record<JobStatus, number>> {
    return this.repository.countJobsByStatus();
  }
}
