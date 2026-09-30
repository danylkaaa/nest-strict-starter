import { createHash, randomInt } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { WebhookDeliveryFailedError } from './webhook.errors.js';

import type { WebhookClient } from './ports/webhook-client.js';
import type { CallWebhookInput, WebhookReceipt } from './webhook.js';
import type { Result } from 'neverthrow';

@Injectable()
export class MockWebhookClient implements WebhookClient {
  async call(input: CallWebhookInput): Promise<Result<WebhookReceipt, WebhookDeliveryFailedError>> {
    await setTimeout(randomInt(1000, 2001));

    if (randomInt(0, 3) === 0) {
      return err(new WebhookDeliveryFailedError());
    }

    // Derived from the delivery key so a repeated call returns the same receipt, as a real
    // provider honoring the key would.
    const digest = createHash('sha256').update(input.deliveryKey).digest();
    return ok({
      body: { accepted: true, value: digest.readUInt32BE(0) % 1_000_000 },
      requestId: `mock_${digest.toString('hex')}`,
      status: 'delivered',
    });
  }
}
