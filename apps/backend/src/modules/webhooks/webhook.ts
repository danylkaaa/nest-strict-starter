import { z } from 'zod';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface WebhookContent {
  readonly url: string;
  readonly payload: JsonValue;
}

/** Shared by the HTTP DTO and the queue handler; only http(s) URLs are accepted. */
export const WebhookContentSchema = z.object({
  payload: z.json(),
  url: z.url({ protocol: /^https?$/u }).max(2048),
});

export interface CallWebhookInput extends WebhookContent {
  readonly jobId: string;
  /** Stable per job so a repeated call after a crash is one delivery for a real provider. */
  readonly deliveryKey: string;
}

export interface CalledWebhook {
  /** ID of the stored succeeded call record (`whc_<ULID>`). */
  readonly callId: string;
  readonly receipt: WebhookReceipt;
}

/** Stable mock receipt: IDs and the body value vary on every successful call. */
export interface WebhookReceipt {
  readonly requestId: string;
  readonly status: 'delivered';
  readonly body: {
    readonly accepted: true;
    readonly value: number;
  };
}

export interface ListWebhookCallsInput {
  readonly jobId: string;
}

export type WebhookCallResult =
  | { readonly outcome: 'succeeded'; readonly receipt: WebhookReceipt }
  | {
      readonly outcome: 'failed';
      readonly error: { readonly name: string; readonly message: string };
    };

export type RecordedWebhookCall = WebhookCallResult & {
  readonly id: string;
  readonly jobId: string;
  readonly recordedAt: Date;
};
