import type { EmailDeliveryFailedError } from '@/modules/emails/email.errors.js';
import type { EmailContent } from '@/modules/emails/email.js';
import type { Result } from 'neverthrow';

export const EMAIL_CLIENT = Symbol('EmailClient');

export interface EmailClient {
  send(
    content: EmailContent,
    deliveryKey?: string,
  ): Promise<Result<{ messageId: string }, EmailDeliveryFailedError>>;
}
