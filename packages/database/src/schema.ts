import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { ulid } from 'ulid';

export const sentEmails = pgTable(
  'sent_emails',
  {
    body: text('body').notNull(),
    deliveryKey: text('delivery_key').unique(),
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

export const jobs = pgTable(
  'jobs',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    id: uuid('id').primaryKey(),
    idempotencyKey: uuid('idempotency_key').notNull().unique(),
    priority: integer('priority').notNull(),
    result: jsonb('result').$type<{ emailId: string }>(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    status: text('status', {
      enum: ['scheduled', 'pending', 'processing', 'cancelled', 'completed', 'failed'],
    }).notNull(),
    type: text('type', { enum: ['instant', 'schedule'] }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('jobs_priority_range', sql`${table.priority} BETWEEN 1 AND 5`),
    check(
      'jobs_status_valid',
      sql`${table.status} IN ('scheduled', 'pending', 'processing', 'cancelled', 'completed', 'failed')`,
    ),
    check('jobs_type_valid', sql`${table.type} IN ('instant', 'schedule')`),
    index('jobs_status_start_at_idx').on(table.status, table.startAt),
  ],
);

export const jobActivity = pgTable(
  'job_activity',
  {
    attempt: integer('attempt'),
    errorCategory: text('error_category'),
    event: text('event', {
      enum: ['created', 'started', 'attempt_failed', 'cancelled', 'completed', 'failed'],
    }).notNull(),
    eventKey: text('event_key').notNull(),
    id: text('id')
      .primaryKey()
      .$defaultFn(() => `jac_${ulid()}`),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('job_activity_id_format', sql`${table.id} ~ '^jac_[0-7][0-9A-HJKMNP-TV-Z]{25}$'`),
    check(
      'job_activity_event_valid',
      sql`${table.event} IN ('created', 'started', 'attempt_failed', 'cancelled', 'completed', 'failed')`,
    ),
    check('job_activity_attempt_positive', sql`${table.attempt} IS NULL OR ${table.attempt} > 0`),
    uniqueIndex('job_activity_job_id_event_key_idx').on(table.jobId, table.eventKey),
    index('job_activity_job_id_id_idx').on(table.jobId, table.id),
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
