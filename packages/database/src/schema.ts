import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
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

export const webhookCalls = pgTable(
  'webhook_calls',
  {
    errorMessage: text('error_message'),
    errorName: text('error_name'),
    id: text('id')
      .primaryKey()
      .$defaultFn(() => `whc_${ulid()}`),
    jobId: text('job_id').notNull(),
    outcome: text('outcome', { enum: ['succeeded', 'failed'] }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    requestId: text('request_id'),
    responseValue: integer('response_value'),
  },
  (table) => [
    check('webhook_calls_id_format', sql`${table.id} ~ '^whc_[0-7][0-9A-HJKMNP-TV-Z]{25}$'`),
    check('webhook_calls_outcome_valid', sql`${table.outcome} IN ('succeeded', 'failed')`),
    check(
      'webhook_calls_result_consistency',
      sql`(${table.outcome} = 'succeeded' AND ${table.requestId} IS NOT NULL AND ${table.responseValue} IS NOT NULL AND ${table.responseValue} BETWEEN 0 AND 999999 AND ${table.errorName} IS NULL AND ${table.errorMessage} IS NULL) OR (${table.outcome} = 'failed' AND ${table.requestId} IS NULL AND ${table.responseValue} IS NULL AND ${table.errorName} IS NOT NULL AND ${table.errorMessage} IS NOT NULL)`,
    ),
    index('webhook_calls_job_id_id_idx').on(table.jobId, table.id),
  ],
);
