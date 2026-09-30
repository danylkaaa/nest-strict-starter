import { Injectable } from '@nestjs/common';
import { ok } from 'neverthrow';

import { EmailClient } from '@/modules/emails/email-client.js';
import { EmailRepository } from '@/modules/emails/email.repository.js';

import type { EmailContent, SentEmail } from '@/modules/emails/email.js';
import type { Result } from 'neverthrow';

@Injectable()
export class SendEmailUseCase {
  constructor(
    private readonly client: EmailClient,
    private readonly repository: EmailRepository,
  ) {}

  async execute(input: EmailContent): Promise<Result<SentEmail, never>> {
    const { messageId } = await this.client.send(input);
    const email = await this.repository.save({ ...input, messageId, sentAt: new Date() });
    return ok(email);
  }
}
