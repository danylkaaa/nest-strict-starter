import type {
  ListWebhookCallsInput,
  RecordedWebhookCall,
  WebhookCallResult,
} from '@/modules/webhooks/webhook.js';

export const WEBHOOK_REPOSITORY = Symbol('WebhookRepository');

export interface WebhookRepository {
  /**
   * Appends a call record and returns its ID. A succeeded call for a job that already has one is
   * not stored again; the existing record's ID is returned.
   */
  save(call: WebhookCallResult & { readonly jobId: string }): Promise<{ readonly id: string }>;
  list(input: ListWebhookCallsInput): Promise<RecordedWebhookCall[]>;
}
