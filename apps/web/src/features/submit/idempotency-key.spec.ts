import { describe, expect, it } from 'vitest';

import { newIdempotencyKey } from './idempotency-key';

describe('newIdempotencyKey', () => {
  it('generates a bare UUID, as the API requires', () => {
    expect(newIdempotencyKey()).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u,
    );
  });

  it('generates a different key every time', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
