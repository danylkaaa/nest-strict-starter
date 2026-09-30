import type { EmailContent, ListSentEmailsInput, SentEmail, SentEmailsPage } from './email.js';

export abstract class EmailRepository {
  abstract save(email: EmailContent & { messageId: string; sentAt: Date }): Promise<SentEmail>;
  abstract list(input: ListSentEmailsInput): Promise<SentEmailsPage>;
}
