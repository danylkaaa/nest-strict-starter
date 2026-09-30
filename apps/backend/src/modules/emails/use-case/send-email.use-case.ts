import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { EMAIL_CLIENT } from '@/modules/emails/ports/email-client.js';
import { EMAIL_REPOSITORY } from '@/modules/emails/ports/email.repository.js';

import type { EmailDeliveryFailedError } from '@/modules/emails/email.errors.js';
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

  async execute(
    input: EmailContent & { deliveryKey?: string },
  ): Promise<Result<SentEmail, EmailDeliveryFailedError>> {
    const delivery = await this.client.send(input, input.deliveryKey);
    if (delivery.isErr()) return err(delivery.error);
    const { messageId } = delivery.value;
    const email = await this.repository.save({ ...input, messageId, sentAt: new Date() });
    return ok(email);
  }
}
