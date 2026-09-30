import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { sentEmails } from '@workspace/database/schema';
import { desc, lt } from 'drizzle-orm';

import type { EmailContent, ListSentEmailsInput, SentEmail, SentEmailsPage } from './email.js';
import type { EmailRepository } from './ports/email.repository.js';
import type { Database } from '@workspace/database/client';

@Injectable()
export class DrizzleEmailRepository implements EmailRepository {
  constructor(@Inject(getDrizzleToken()) private readonly database: Database) {}

  async save(email: EmailContent & { messageId: string; sentAt: Date }): Promise<SentEmail> {
    const [saved] = await this.database
      .insert(sentEmails)
      .values(email)
      .returning()
      .catch(() => {
        // Drizzle query errors include email parameters; keep them out of application logs.
        throw new Error('Failed to persist sent email.');
      });
    if (!saved) throw new Error('Sent email insert returned no record.');
    return saved;
  }

  async list({ cursor, limit }: ListSentEmailsInput): Promise<SentEmailsPage> {
    const rows = await this.database
      .select()
      .from(sentEmails)
      .where(cursor === undefined ? undefined : lt(sentEmails.id, cursor))
      .orderBy(desc(sentEmails.id))
      .limit(limit + 1)
      .catch(() => {
        throw new Error('Failed to list sent emails.');
      });
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }
}
