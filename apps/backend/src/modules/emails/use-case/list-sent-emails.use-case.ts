import { Injectable } from '@nestjs/common';
import { ok } from 'neverthrow';

import { EmailRepository } from '@/modules/emails/email.repository.js';

import type { ListSentEmailsInput, SentEmailsPage } from '@/modules/emails/email.js';
import type { Result } from 'neverthrow';

@Injectable()
export class ListSentEmailsUseCase {
  constructor(private readonly repository: EmailRepository) {}

  async execute(input: ListSentEmailsInput): Promise<Result<SentEmailsPage, never>> {
    return ok(await this.repository.list(input));
  }
}
