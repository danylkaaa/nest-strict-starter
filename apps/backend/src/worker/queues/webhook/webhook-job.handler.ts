import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { WEBHOOK_QUEUE } from '@/common/queue/queue.service.js';
import { CompleteJobUseCase } from '@/modules/jobs/use-case/complete-job.use-case.js';
import { FailJobAttemptUseCase } from '@/modules/jobs/use-case/fail-job-attempt.use-case.js';
import { StartJobAttemptUseCase } from '@/modules/jobs/use-case/start-job-attempt.use-case.js';
import { CallWebhookUseCase } from '@/modules/webhooks/use-case/call-webhook.use-case.js';
import { WebhookContentSchema } from '@/modules/webhooks/webhook.js';
import { jobLog } from '@/worker/core/job-log.js';
import { JobHandler } from '@/worker/core/pg-boss/job-handler.decorator.js';

import type { Job, JobResult } from 'pg-boss';

@Injectable()
@JobHandler(WEBHOOK_QUEUE)
export class WebhookJobHandler {
  constructor(
    private readonly logger: PinoLogger,
    private readonly callWebhook: CallWebhookUseCase,
    private readonly startAttempt: StartJobAttemptUseCase,
    private readonly failAttempt: FailJobAttemptUseCase,
    private readonly completeJob: CompleteJobUseCase,
  ) {
    this.logger.setContext(WebhookJobHandler.name);
  }

  async handle(job: Job<unknown>): Promise<JobResult> {
    const attempt = job.retryCount + 1;
    this.logger.info(jobLog(WEBHOOK_QUEUE, job.id, attempt, 'pickup'));
    if (!(await this.startAttempt.execute(job.id, attempt))) {
      this.logger.warn(jobLog(WEBHOOK_QUEUE, job.id, attempt, 'failed'));
      return { id: job.id, status: 'deadletter' };
    }
    const parsed = WebhookContentSchema.safeParse(job.data);
    if (!parsed.success) {
      await this.failAttempt.execute(job.id, attempt, 'invalid_payload', true);
      this.logger.warn(jobLog(WEBHOOK_QUEUE, job.id, attempt, 'invalid_payload'));
      return { id: job.id, status: 'deadletter' };
    }
    try {
      const called = await this.callWebhook.execute({
        ...parsed.data,
        deliveryKey: `webhook-job:${job.id}`,
        jobId: job.id,
      });
      if (called.isOk()) {
        await this.completeJob.execute(job.id, attempt, { webhookCallId: called.value.callId });
        this.logger.info(jobLog(WEBHOOK_QUEUE, job.id, attempt, 'completed'));
        return { id: job.id, status: 'completed' };
      }
    } catch {
      return this.failAttemptFor(job.id, attempt, 'delivery_or_storage');
    }
    return this.failAttemptFor(job.id, attempt, 'delivery_failed');
  }

  private async failAttemptFor(id: string, attempt: number, category: string): Promise<JobResult> {
    const { terminal } = await this.failAttempt.execute(id, attempt, category, false);
    this.logger.warn(jobLog(WEBHOOK_QUEUE, id, attempt, terminal ? 'failed' : 'retry_scheduled'));
    return { id, status: terminal ? 'deadletter' : 'failed' };
  }
}
