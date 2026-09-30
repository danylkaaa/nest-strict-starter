// The UI owns idempotency: one key per distinct submission, so a repeated or retried submit of
// the same form returns the existing job instead of creating a duplicate.
// The API requires a UUID, so the key is a bare UUID.
export const newIdempotencyKey = (): string => crypto.randomUUID();
