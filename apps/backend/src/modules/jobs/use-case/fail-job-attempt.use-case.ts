import { Injectable } from '@nestjs/common';

import { JobService } from '@/modules/jobs/job.service.js';

@Injectable()
export class FailJobAttemptUseCase {
  constructor(private readonly jobs: JobService) {}

  /**
   * Records the failed attempt. `deadLetter` ends the job at once (input errors); otherwise the
   * job's own `maxAttempts` decides whether this was the last attempt, reported as `terminal`.
   */
  async execute(
    id: string,
    attempt: number,
    category: string,
    deadLetter: boolean,
  ): Promise<{ terminal: boolean }> {
    return this.jobs.recordFailure(id, attempt, category, deadLetter);
  }
}
