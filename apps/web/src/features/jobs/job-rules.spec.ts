import { describe, expect, it } from 'vitest';

import { canCancel, canRetry } from './job-rules';

describe('job rules', () => {
  it('allows cancelling jobs that have not started', () => {
    expect(canCancel({ status: 'scheduled', type: 'email' })).toBe(true);
    expect(canCancel({ status: 'pending', type: 'webhook' })).toBe(true);
  });

  it('allows cancelling a running batch but not other running jobs', () => {
    expect(canCancel({ status: 'processing', type: 'batch' })).toBe(true);
    expect(canCancel({ status: 'processing', type: 'email' })).toBe(false);
  });

  it('refuses to cancel finished jobs', () => {
    expect(canCancel({ status: 'completed', type: 'email' })).toBe(false);
    expect(canCancel({ status: 'failed', type: 'batch' })).toBe(false);
  });

  it('allows retrying failed jobs only', () => {
    expect(canRetry({ status: 'failed' })).toBe(true);
    expect(canRetry({ status: 'completed' })).toBe(false);
  });
});
