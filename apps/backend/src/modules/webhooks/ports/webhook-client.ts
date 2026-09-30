import type { WebhookDeliveryFailedError } from '@/modules/webhooks/webhook.errors.js';
import type { CallWebhookInput, WebhookReceipt } from '@/modules/webhooks/webhook.js';
import type { Result } from 'neverthrow';

export const WEBHOOK_CLIENT = Symbol('WebhookClient');

export interface WebhookClient {
  call(input: CallWebhookInput): Promise<Result<WebhookReceipt, WebhookDeliveryFailedError>>;
}
