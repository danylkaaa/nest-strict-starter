import { Injectable } from '@nestjs/common';

import { JobService } from '@/modules/jobs/job.service.js';

@Injectable()
export class CompleteJobUseCase {
  constructor(private readonly jobs: JobService) {}
  async execute(id: string, attempt: number, emailId: string): Promise<void> {
    await this.jobs.recordCompletion(id, attempt, emailId);
  }
}
