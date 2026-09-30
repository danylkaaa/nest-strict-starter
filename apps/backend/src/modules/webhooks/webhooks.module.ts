import { Module } from '@nestjs/common';

import { MockWebhookClient } from './mock-webhook.client.js';
import { WEBHOOK_CLIENT } from './ports/webhook-client.js';
import { WEBHOOK_REPOSITORY } from './ports/webhook.repository.js';
import { CallWebhookUseCase } from './use-case/call-webhook.use-case.js';
import { ListWebhookCallsUseCase } from './use-case/list-webhook-calls.use-case.js';
import { DrizzleWebhookRepository } from './webhook.repository.js';

@Module({
  exports: [CallWebhookUseCase, ListWebhookCallsUseCase],
  providers: [
    CallWebhookUseCase,
    ListWebhookCallsUseCase,
    { provide: WEBHOOK_CLIENT, useClass: MockWebhookClient },
    { provide: WEBHOOK_REPOSITORY, useClass: DrizzleWebhookRepository },
  ],
})
export class WebhooksModule {}
