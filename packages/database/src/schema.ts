import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { ulid } from 'ulid';

export const users = pgTable(
  'users',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    email: text('email').notNull().unique(),
    id: text('id')
      .primaryKey()
      .$defaultFn(() => `usr_${ulid()}`),
    passwordHash: text('password_hash').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('users_id_format', sql`${table.id} ~ '^usr_[0-7][0-9A-HJKMNP-TV-Z]{25}$'`)],
);
