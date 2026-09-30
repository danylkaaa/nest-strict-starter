import { describe, expect, it } from 'vitest';

import { retryDelaySeconds, retryPolicy } from './retry-policy.js';

describe('retry delay schedule', () => {
  it('waits 5, 10, then 30 seconds after the first three failed attempts', () => {
    expect([1, 2, 3].map((attempt) => retryDelaySeconds(attempt))).toEqual([5, 10, 30]);
  });

  it('keeps waiting 30 seconds for every later attempt', () => {
    expect([4, 5, 10, 11, 50].map((attempt) => retryDelaySeconds(attempt))).toEqual([
      30, 30, 30, 30, 30,
    ]);
  });

  it('treats an attempt below 1 like the first', () => {
    expect(retryDelaySeconds(0)).toBe(5);
  });
});

describe('retry policy', () => {
  it('starts with the first delay, no backoff, and one fewer retry than attempts', () => {
    expect(retryPolicy(4)).toEqual({ retryBackoff: false, retryDelay: 5, retryLimit: 3 });
  });
});
