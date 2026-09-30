import { Inject, Injectable } from '@nestjs/common';
import { ok } from 'neverthrow';

import { WEBHOOK_REPOSITORY } from '@/modules/webhooks/ports/webhook.repository.js';

import type { WebhookRepository } from '@/modules/webhooks/ports/webhook.repository.js';
import type { ListWebhookCallsInput, RecordedWebhookCall } from '@/modules/webhooks/webhook.js';
import type { Result } from 'neverthrow';

export type { ListWebhookCallsInput, RecordedWebhookCall } from '@/modules/webhooks/webhook.js';

@Injectable()
export class ListWebhookCallsUseCase {
  constructor(@Inject(WEBHOOK_REPOSITORY) private readonly repository: WebhookRepository) {}

  async execute(input: ListWebhookCallsInput): Promise<Result<RecordedWebhookCall[], never>> {
    return ok(await this.repository.list(input));
  }
}
