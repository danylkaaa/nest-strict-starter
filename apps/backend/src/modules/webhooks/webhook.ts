export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface CallWebhookInput {
  readonly jobId: string;
  readonly url: string;
  readonly payload: JsonValue;
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
