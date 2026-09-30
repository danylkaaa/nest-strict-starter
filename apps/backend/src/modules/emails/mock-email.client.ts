import { createHash, randomInt, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { EmailDeliveryFailedError } from './email.errors.js';

import type { EmailContent } from './email.js';
import type { EmailClient } from './ports/email-client.js';
import type { Result } from 'neverthrow';

@Injectable()
export class MockEmailClient implements EmailClient {
  async send(
    content: EmailContent,
    deliveryKey?: string,
  ): Promise<Result<{ messageId: string }, EmailDeliveryFailedError>> {
    await setTimeout(randomInt(1000, 3001));

    // Demo hook: a @bounce.test recipient always fails so retries can be shown on demand.
    if (content.recipient.toLowerCase().endsWith('@bounce.test') || randomInt(0, 10) === 0) {
      return err(new EmailDeliveryFailedError());
    }

    return ok({
      messageId:
        deliveryKey === undefined
          ? `mock_${randomUUID()}`
          : `mock_${createHash('sha256').update(deliveryKey).digest('hex')}`,
    });
  }
}
