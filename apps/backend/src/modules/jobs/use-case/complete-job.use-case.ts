import { Injectable } from '@nestjs/common';

import { JobService } from '@/modules/jobs/job.service.js';

import type { JobResult } from '@/modules/jobs/job.js';

@Injectable()
export class CompleteJobUseCase {
  constructor(private readonly jobs: JobService) {}
  async execute(id: string, attempt: number, result: JobResult): Promise<void> {
    await this.jobs.recordCompletion(id, attempt, result);
  }
}
