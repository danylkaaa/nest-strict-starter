import { Injectable } from '@nestjs/common';

import { JobService } from '@/modules/jobs/job.service.js';

@Injectable()
export class FailJobAttemptUseCase {
  constructor(private readonly jobs: JobService) {}
  async execute(id: string, attempt: number, category: string, terminal: boolean): Promise<void> {
    await this.jobs.recordFailure(id, attempt, category, terminal);
  }
}
