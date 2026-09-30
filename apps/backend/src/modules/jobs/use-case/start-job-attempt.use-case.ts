import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

@Injectable()
export class StartJobAttemptUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}
  async execute(id: string, attempt: number): Promise<void> {
    await this.repository.recordStart(id, attempt);
  }
}
