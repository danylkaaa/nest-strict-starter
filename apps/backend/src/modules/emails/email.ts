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
