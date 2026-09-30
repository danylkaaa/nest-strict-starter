import { Inject, Injectable } from '@nestjs/common';

import { WEBHOOK_CLIENT } from '@/modules/webhooks/ports/webhook-client.js';
import { WEBHOOK_REPOSITORY } from '@/modules/webhooks/ports/webhook.repository.js';

import type { WebhookClient } from '@/modules/webhooks/ports/webhook-client.js';
import type { WebhookRepository } from '@/modules/webhooks/ports/webhook.repository.js';
import type { WebhookDeliveryFailedError } from '@/modules/webhooks/webhook.errors.js';
import type { CalledWebhook, CallWebhookInput } from '@/modules/webhooks/webhook.js';
import type { Result } from 'neverthrow';

export type {
  CalledWebhook,
  CallWebhookInput,
  WebhookReceipt,
} from '@/modules/webhooks/webhook.js';
export type { WebhookDeliveryFailedError } from '@/modules/webhooks/webhook.errors.js';

@Injectable()
export class CallWebhookUseCase {
  constructor(
    @Inject(WEBHOOK_CLIENT) private readonly client: WebhookClient,
    @Inject(WEBHOOK_REPOSITORY) private readonly repository: WebhookRepository,
  ) {}

  async execute(
    input: CallWebhookInput,
  ): Promise<Result<CalledWebhook, WebhookDeliveryFailedError>> {
    const result = await this.client.call(input);
    const saved = await this.repository.save(
      result.isOk()
        ? { jobId: input.jobId, outcome: 'succeeded', receipt: result.value }
        : {
            error: { message: result.error.message, name: result.error.name },
            jobId: input.jobId,
            outcome: 'failed',
          },
    );
    return result.map((receipt) => ({ callId: saved.id, receipt }));
  }
}
