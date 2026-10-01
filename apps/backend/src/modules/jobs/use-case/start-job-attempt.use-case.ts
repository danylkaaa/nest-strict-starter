import { Injectable } from '@nestjs/common';

import { JobService } from '@/modules/jobs/job.service.js';

@Injectable()
export class StartJobAttemptUseCase {
  constructor(private readonly jobs: JobService) {}
  async execute(id: string, attempt: number): Promise<boolean> {
    return this.jobs.recordStart(id, attempt);
  }
}
