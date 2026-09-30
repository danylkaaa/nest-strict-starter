import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { webhookCalls } from '@workspace/database/schema';
import { and, desc, eq } from 'drizzle-orm';

import type { WebhookRepository } from './ports/webhook.repository.js';
import type { ListWebhookCallsInput, RecordedWebhookCall, WebhookCallResult } from './webhook.js';
import type { Database } from '@workspace/database/client';

@Injectable()
export class DrizzleWebhookRepository implements WebhookRepository {
  constructor(@Inject(getDrizzleToken()) private readonly database: Database) {}

  async save(call: WebhookCallResult & { readonly jobId: string }): Promise<{ id: string }> {
    const values =
      call.outcome === 'succeeded'
        ? {
            jobId: call.jobId,
            outcome: call.outcome,
            requestId: call.receipt.requestId,
            responseValue: call.receipt.body.value,
          }
        : {
            errorMessage: call.error.message,
            errorName: call.error.name,
            jobId: call.jobId,
            outcome: call.outcome,
          };
    // A second success for a job (retry after a crash) conflicts with the partial unique index
    // and resolves to the stored record instead of a duplicate.
    const [saved] = await this.database
      .insert(webhookCalls)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: webhookCalls.id })
      .catch(() => {
        // Drizzle query errors include parameters; keep them out of application logs.
        throw new Error('Failed to persist webhook call.');
      });
    if (saved) return saved;
    const [existing] = await this.database
      .select({ id: webhookCalls.id })
      .from(webhookCalls)
      .where(and(eq(webhookCalls.jobId, call.jobId), eq(webhookCalls.outcome, 'succeeded')))
      .catch(() => {
        throw new Error('Failed to persist webhook call.');
      });
    if (!existing) throw new Error('Failed to persist webhook call.');
    return existing;
  }

  async list({ jobId }: ListWebhookCallsInput): Promise<RecordedWebhookCall[]> {
    const rows = await this.database
      .select()
      .from(webhookCalls)
      .where(eq(webhookCalls.jobId, jobId))
      .orderBy(desc(webhookCalls.recordedAt), desc(webhookCalls.id))
      .catch(() => {
        throw new Error('Failed to list webhook calls.');
      });
    return rows.map((row): RecordedWebhookCall => {
      if (row.outcome === 'succeeded') {
        if (row.requestId === null || row.responseValue === null) {
          throw new Error('Stored webhook success is missing its receipt.');
        }
        return {
          id: row.id,
          jobId: row.jobId,
          outcome: 'succeeded',
          receipt: {
            body: { accepted: true, value: row.responseValue },
            requestId: row.requestId,
            status: 'delivered',
          },
          recordedAt: row.recordedAt,
        };
      }
      if (row.errorName === null || row.errorMessage === null) {
        throw new Error('Stored webhook failure is missing its error.');
      }
      return {
        error: { message: row.errorMessage, name: row.errorName },
        id: row.id,
        jobId: row.jobId,
        outcome: 'failed',
        recordedAt: row.recordedAt,
      };
    });
  }
}
