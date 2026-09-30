import { z } from 'zod';

export interface EmailContent {
  recipient: string;
  subject: string;
  body: string;
}

export interface SentEmail extends EmailContent {
  id: string;
  messageId: string;
  sentAt: Date;
}

export interface ListSentEmailsInput {
  cursor?: string;
  limit: number;
}

export interface SentEmailsPage {
  items: SentEmail[];
  nextCursor: string | null;
}
export const EmailContentSchema = z.object({
  body: z.string().trim().min(1).max(100_000),
  recipient: z.email().max(254),
  subject: z.string().trim().min(1).max(998),
});
