import type {
  ListWebhookCallsInput,
  RecordedWebhookCall,
  WebhookCallResult,
} from '@/modules/webhooks/webhook.js';

export const WEBHOOK_REPOSITORY = Symbol('WebhookRepository');

export interface WebhookRepository {
  save(call: WebhookCallResult & { readonly jobId: string }): Promise<void>;
  list(input: ListWebhookCallsInput): Promise<RecordedWebhookCall[]>;
}
