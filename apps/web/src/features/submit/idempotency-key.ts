// The UI owns idempotency: one key per distinct submission, so a repeated or retried submit of
// the same form returns the existing job instead of creating a duplicate.
export const newIdempotencyKey = (): string => `web-${crypto.randomUUID()}`;
