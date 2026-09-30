import { Injectable } from '@nestjs/common';

import { JobService } from '@/modules/jobs/job.service.js';

@Injectable()
export class ReconcileJobsUseCase {
  constructor(private readonly jobs: JobService) {}
  async execute(): Promise<void> {
    await this.jobs.reconcileProcessing();
  }
}
