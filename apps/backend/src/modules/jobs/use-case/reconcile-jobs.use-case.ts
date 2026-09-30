import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

@Injectable()
export class ReconcileJobsUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}
  async execute(): Promise<void> {
    await this.repository.reconcileProcessing();
  }
}
