import type {
  EmailContent,
  ListSentEmailsInput,
  SentEmail,
  SentEmailsPage,
} from '@/modules/emails/email.js';

export const EMAIL_REPOSITORY = Symbol('EmailRepository');

export interface EmailRepository {
  save(email: EmailContent & { messageId: string; sentAt: Date }): Promise<SentEmail>;
  list(input: ListSentEmailsInput): Promise<SentEmailsPage>;
}
