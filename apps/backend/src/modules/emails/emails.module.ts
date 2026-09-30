import { Module } from '@nestjs/common';

import { DrizzleEmailRepository } from './drizzle-email.repository.js';
import { EmailClient } from './email-client.js';
import { EmailRepository } from './email.repository.js';
import { MockEmailClient } from './mock-email.client.js';
import { ListSentEmailsUseCase } from './use-case/list-sent-emails.use-case.js';
import { SendEmailUseCase } from './use-case/send-email.use-case.js';

@Module({
  exports: [SendEmailUseCase, ListSentEmailsUseCase],
  providers: [
    SendEmailUseCase,
    ListSentEmailsUseCase,
    { provide: EmailClient, useClass: MockEmailClient },
    { provide: EmailRepository, useClass: DrizzleEmailRepository },
  ],
})
export class EmailsModule {}
