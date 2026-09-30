import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { ulid } from 'ulid';

export const sentEmails = pgTable(
  'sent_emails',
  {
    body: text('body').notNull(),
    id: text('id')
      .primaryKey()
      .$defaultFn(() => `eml_${ulid()}`),
    messageId: text('message_id').notNull().unique(),
    recipient: text('recipient').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    subject: text('subject').notNull(),
  },
  (table) => [
    check('sent_emails_id_format', sql`${table.id} ~ '^eml_[0-7][0-9A-HJKMNP-TV-Z]{25}$'`),
  ],
);
