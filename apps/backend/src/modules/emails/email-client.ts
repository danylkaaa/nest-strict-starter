import type { EmailContent } from './email.js';

export abstract class EmailClient {
  abstract send(content: EmailContent): Promise<{ messageId: string }>;
}
