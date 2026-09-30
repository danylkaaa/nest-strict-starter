import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

@Injectable()
export class CompleteJobUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}
  async execute(id: string, attempt: number, emailId: string): Promise<void> {
    await this.repository.recordCompletion(id, attempt, emailId);
  }
}
