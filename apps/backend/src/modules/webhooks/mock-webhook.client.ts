import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { WebhookDeliveryFailedError } from './webhook.errors.js';

import type { WebhookClient } from './ports/webhook-client.js';
import type { CallWebhookInput, WebhookReceipt } from './webhook.js';
import type { Result } from 'neverthrow';

@Injectable()
export class MockWebhookClient implements WebhookClient {
  async call(
    _input: CallWebhookInput,
  ): Promise<Result<WebhookReceipt, WebhookDeliveryFailedError>> {
    await setTimeout(randomInt(1000, 2001));

    if (randomInt(0, 10) === 0) {
      return err(new WebhookDeliveryFailedError());
    }

    return ok({
      body: { accepted: true, value: randomInt(0, 1_000_000) },
      requestId: `mock_${randomUUID()}`,
      status: 'delivered',
    });
  }
}
