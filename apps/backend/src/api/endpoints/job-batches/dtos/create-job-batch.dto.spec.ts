import { describe, expect, it } from 'vitest';

import { CreateJobBatchSchema } from './create-job-batch.dto.js';

const email = {
  payload: { body: 'Hi', recipient: 'a@example.com', subject: 'Hello' },
  type: 'email',
};
const envelope = {
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  items: [email],
  priority: 3,
  type: 'instant',
};

const items = (count: number) => Array.from({ length: count }, () => email);

describe('createJobBatchSchema', () => {
  it('accepts mixed children and defaults maxAttempts to 4', () => {
    const parsed = CreateJobBatchSchema.parse({
      ...envelope,
      items: [
        email,
        { payload: { payload: 1, url: 'https://example.com/hook' }, type: 'webhook' },
        {
          payload: {
            aircraftId: 'acf_1',
            departureAt: '2031-01-01T10:00:00Z',
            destinationIcao: 'KSFO',
            originIcao: 'RJTT',
          },
          type: 'aircraft-report',
        },
      ],
    });
    expect(parsed.maxAttempts).toBe(4);
    expect(parsed.items.map((item) => item.type)).toEqual(['email', 'webhook', 'aircraft-report']);
  });

  it('accepts 1 and 100 children and rejects 0 and 101', () => {
    expect(CreateJobBatchSchema.safeParse({ ...envelope, items: items(1) }).success).toBe(true);
    expect(CreateJobBatchSchema.safeParse({ ...envelope, items: items(100) }).success).toBe(true);
    expect(CreateJobBatchSchema.safeParse({ ...envelope, items: [] }).success).toBe(false);
    expect(CreateJobBatchSchema.safeParse({ ...envelope, items: items(101) }).success).toBe(false);
  });

  it.each([
    ['a nested batch', { items: [email], type: 'batch' }],
    ['a reference to an existing job', { jobId: 'f1c0a1d2-0000-4000-8000-000000000001' }],
    ['an unknown child type', { payload: {}, type: 'sms' }],
    ['a child with an extra property', { ...email, id: 'x' }],
  ])('rejects %s', (_name, item) => {
    expect(CreateJobBatchSchema.safeParse({ ...envelope, items: [item] }).success).toBe(false);
  });

  it('keeps the shared envelope rules', () => {
    expect(CreateJobBatchSchema.safeParse({ ...envelope, type: 'schedule' }).success).toBe(false);
    expect(
      CreateJobBatchSchema.safeParse({ ...envelope, startAt: '2031-01-01T10:00:00Z' }).success,
    ).toBe(false);
    expect(CreateJobBatchSchema.safeParse({ ...envelope, priority: 6 }).success).toBe(false);
    expect(CreateJobBatchSchema.safeParse({ ...envelope, idempotencyKey: 'key' }).success).toBe(
      false,
    );
    expect(CreateJobBatchSchema.safeParse({ ...envelope, maxAttempts: 11 }).success).toBe(false);
  });
});
