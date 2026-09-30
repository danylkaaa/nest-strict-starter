import { Inject, Injectable } from '@nestjs/common';
import { ok } from 'neverthrow';

import { EMAIL_CLIENT } from '@/modules/emails/ports/email-client.js';
import { EMAIL_REPOSITORY } from '@/modules/emails/ports/email.repository.js';

import type { EmailContent, SentEmail } from '@/modules/emails/email.js';
import type { EmailClient } from '@/modules/emails/ports/email-client.js';
import type { EmailRepository } from '@/modules/emails/ports/email.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class SendEmailUseCase {
  constructor(
    @Inject(EMAIL_CLIENT) private readonly client: EmailClient,
    @Inject(EMAIL_REPOSITORY) private readonly repository: EmailRepository,
  ) {}

  async execute(input: EmailContent): Promise<Result<SentEmail, never>> {
    const { messageId } = await this.client.send(input);
    const email = await this.repository.save({ ...input, messageId, sentAt: new Date() });
    return ok(email);
  }
}
