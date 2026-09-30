import { Module } from '@nestjs/common';

import { DrizzleEmailRepository } from './email.repository.js';
import { MockEmailClient } from './mock-email.client.js';
import { EMAIL_CLIENT } from './ports/email-client.js';
import { EMAIL_REPOSITORY } from './ports/email.repository.js';
import { ListSentEmailsUseCase } from './use-case/list-sent-emails.use-case.js';
import { SendEmailUseCase } from './use-case/send-email.use-case.js';

@Module({
  exports: [SendEmailUseCase, ListSentEmailsUseCase],
  providers: [
    SendEmailUseCase,
    ListSentEmailsUseCase,
    { provide: EMAIL_CLIENT, useClass: MockEmailClient },
    { provide: EMAIL_REPOSITORY, useClass: DrizzleEmailRepository },
  ],
})
export class EmailsModule {}
