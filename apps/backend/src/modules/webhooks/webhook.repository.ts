import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { webhookCalls } from '@workspace/database/schema';
import { desc, eq } from 'drizzle-orm';

import type { WebhookRepository } from './ports/webhook.repository.js';
import type { ListWebhookCallsInput, RecordedWebhookCall, WebhookCallResult } from './webhook.js';
import type { Database } from '@workspace/database/client';

@Injectable()
export class DrizzleWebhookRepository implements WebhookRepository {
  constructor(@Inject(getDrizzleToken()) private readonly database: Database) {}

  async save(call: WebhookCallResult & { readonly jobId: string }): Promise<void> {
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
    await this.database
      .insert(webhookCalls)
      .values(values)
      .catch(() => {
        // Drizzle query errors include parameters; keep them out of application logs.
        throw new Error('Failed to persist webhook call.');
      });
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
