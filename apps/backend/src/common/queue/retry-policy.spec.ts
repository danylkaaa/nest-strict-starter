import { describe, expect, it } from 'vitest';

import { retryPolicy } from './retry-policy.js';

describe('retry policy', () => {
  it('uses exponential backoff from five seconds capped at sixty seconds', () => {
    expect(retryPolicy(4)).toEqual({
      retryBackoff: true,
      retryDelay: 5,
      retryDelayMax: 60,
      retryLimit: 3,
    });
  });
});
