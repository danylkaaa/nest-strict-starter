import type { EmailContent } from '@/modules/emails/email.js';

export const EMAIL_CLIENT = Symbol('EmailClient');

export interface EmailClient {
  send(content: EmailContent): Promise<{ messageId: string }>;
}
