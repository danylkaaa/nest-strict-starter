import { Inject, Injectable } from '@nestjs/common';

import { summarizeBatch } from '@/modules/jobs/job-batch.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import type { JobBatchesPage, ListJobBatchesInput } from '@/modules/jobs/job-batch.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';

@Injectable()
export class ListJobBatchesUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async execute(input: ListJobBatchesInput): Promise<JobBatchesPage> {
    const { items, total } = await this.repository.listJobBatches(input);
    const now = new Date();
    return {
      items: items.map(({ batch, children }) => summarizeBatch(batch, children, now)),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  }
}
