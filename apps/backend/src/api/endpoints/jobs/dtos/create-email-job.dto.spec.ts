import { describe, expect, it } from 'vitest';

import { CreateEmailJobSchema } from './create-email-job.dto.js';

const payload = { body: 'World', recipient: 'a@example.com', subject: 'Hello' };

describe('createEmailJobSchema', () => {
  it('accepts an instant job with bounded priority', () => {
    expect(
      CreateEmailJobSchema.safeParse({
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        payload,
        priority: 5,
        type: 'instant',
      }).success,
    ).toBe(true);
  });

  it('rejects missing schedule time and out-of-range priority', () => {
    expect(
      CreateEmailJobSchema.safeParse({
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        payload,
        priority: 5,
        type: 'schedule',
      }).success,
    ).toBe(false);
    expect(
      CreateEmailJobSchema.safeParse({
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        payload,
        priority: 6,
        type: 'instant',
      }).success,
    ).toBe(false);
  });

  it('rejects startAt on instant jobs so they are immediately eligible', () => {
    expect(
      CreateEmailJobSchema.safeParse({
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        payload,
        priority: 1,
        startAt: new Date(Date.now() + 60_000).toISOString(),
        type: 'instant',
      }).success,
    ).toBe(false);
  });

  it('rejects a non-UUID submission key', () => {
    expect(
      CreateEmailJobSchema.safeParse({
        idempotencyKey: 'request-1',
        payload,
        priority: 1,
        type: 'instant',
      }).success,
    ).toBe(false);
  });
});
