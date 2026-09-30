import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobsPage, ListJobsInput } from '@/modules/jobs/job.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

@Injectable()
export class ListJobsUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async execute(input: ListJobsInput): Promise<JobsPage> {
    const { items, total } = await this.repository.listJobs(input);
    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  }
}
