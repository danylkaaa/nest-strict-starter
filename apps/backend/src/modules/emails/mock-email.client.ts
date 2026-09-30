import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';

import { EmailClient } from './email-client.js';

import type { EmailContent } from './email.js';

@Injectable()
export class MockEmailClient extends EmailClient {
  override async send(_content: EmailContent): Promise<{ messageId: string }> {
    await setTimeout(randomInt(1000, 3001));
    return { messageId: `mock_${randomUUID()}` };
  }
}
