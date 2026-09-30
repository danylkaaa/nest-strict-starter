import { Inject, Injectable } from '@nestjs/common';
import { err } from 'neverthrow';

import { WEBHOOK_QUEUE } from '@/common/queue/queue.service.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import { checkSubmission, enqueueJob } from './submit-job.js';

import type { JobConflictError, JobScheduleError } from '@/modules/jobs/job.errors.js';
import type { CreateJobInput } from '@/modules/jobs/job.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { WebhookContent } from '@/modules/webhooks/webhook.js';
import type { Result } from 'neverthrow';

export type CreateWebhookJobInput = CreateJobInput<WebhookContent>;

@Injectable()
export class CreateWebhookJobUseCase {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async execute(
    input: CreateWebhookJobInput,
  ): Promise<Result<{ id: string; startAt: Date }, JobConflictError | JobScheduleError>> {
    const checked = await checkSubmission(this.repository, input);
    if (checked.isErr()) return err(checked.error);
    return enqueueJob(this.repository, WEBHOOK_QUEUE, input);
  }
}
