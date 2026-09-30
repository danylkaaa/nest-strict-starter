import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

@Injectable()
export class FailJobAttemptUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}
  async execute(id: string, attempt: number, category: string, terminal: boolean): Promise<void> {
    await this.repository.recordFailure(id, attempt, category, terminal);
  }
}
