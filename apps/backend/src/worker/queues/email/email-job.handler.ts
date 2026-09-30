import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { z } from 'zod';

import { EMAIL_QUEUE } from '@/common/queue/queue.service.js';
import { EmailContentSchema } from '@/modules/emails/email.js';
import { SendEmailUseCase } from '@/modules/emails/use-case/send-email.use-case.js';
import { CompleteJobUseCase } from '@/modules/jobs/use-case/complete-job.use-case.js';
import { FailJobAttemptUseCase } from '@/modules/jobs/use-case/fail-job-attempt.use-case.js';
import { StartJobAttemptUseCase } from '@/modules/jobs/use-case/start-job-attempt.use-case.js';
import { JobHandler } from '@/worker/core/pg-boss/job-handler.decorator.js';

import { jobLog } from './job-log.js';

import type { Job, JobResult } from 'pg-boss';

@Injectable()
@JobHandler(EMAIL_QUEUE)
export class EmailJobHandler {
  constructor(
    private readonly logger: PinoLogger,
    private readonly sendEmail: SendEmailUseCase,
    private readonly startAttempt: StartJobAttemptUseCase,
    private readonly failAttempt: FailJobAttemptUseCase,
    private readonly completeJob: CompleteJobUseCase,
  ) {
    this.logger.setContext(EmailJobHandler.name);
  }

  async handle(job: Job<unknown>): Promise<JobResult> {
    const attempt = job.retryCount + 1;
    this.logger.info(jobLog(job.id, attempt, 'pickup'));
    await this.startAttempt.execute(job.id, attempt);
    const parsed = EmailContentSchema.safeParse(job.data);
    if (!parsed.success) {
      await this.failAttempt.execute(job.id, attempt, 'invalid_payload', true);
      this.logger.warn(jobLog(job.id, attempt, 'invalid_payload'));
      return { id: job.id, status: 'deadletter' };
    }
    try {
      const sent = await this.sendEmail.execute({
        ...parsed.data,
        deliveryKey: `email-job:${job.id}`,
      });
      if (sent.isOk()) {
        await this.completeJob.execute(job.id, attempt, sent.value.id);
        this.logger.info(jobLog(job.id, attempt, 'completed'));
        return { id: job.id, status: 'completed' };
      }
    } catch (error) {
      const category = error instanceof z.ZodError ? 'invalid_payload' : 'delivery_or_storage';
      return this.failAttemptFor(job.id, attempt, category);
    }
    return this.failAttemptFor(job.id, attempt, 'delivery_failed');
  }

  private async failAttemptFor(id: string, attempt: number, category: string): Promise<JobResult> {
    const terminal = attempt >= 4;
    await this.failAttempt.execute(id, attempt, category, terminal);
    this.logger.warn(jobLog(id, attempt, terminal ? 'failed' : 'retry_scheduled'));
    return { id, status: terminal ? 'deadletter' : 'failed' };
  }
}
