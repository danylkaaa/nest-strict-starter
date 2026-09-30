import { Inject, Injectable } from '@nestjs/common';
import { ok } from 'neverthrow';

import { EMAIL_REPOSITORY } from '@/modules/emails/ports/email.repository.js';

import type { ListSentEmailsInput, SentEmailsPage } from '@/modules/emails/email.js';
import type { EmailRepository } from '@/modules/emails/ports/email.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class ListSentEmailsUseCase {
  constructor(@Inject(EMAIL_REPOSITORY) private readonly repository: EmailRepository) {}

  async execute(input: ListSentEmailsInput): Promise<Result<SentEmailsPage, never>> {
    return ok(await this.repository.list(input));
  }
}
