import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobStats } from '@/modules/jobs/job.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

@Injectable()
export class GetJobStatsUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async execute(): Promise<JobStats> {
    const [counts, healthy] = await Promise.all([
      this.repository.countJobsByStatus(),
      this.repository.isHealthy(),
    ]);
    return { counts, healthy };
  }
}
