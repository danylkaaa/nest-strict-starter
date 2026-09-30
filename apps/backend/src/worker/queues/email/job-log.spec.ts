import { describe, expect, it } from 'vitest';

import { jobLog } from './job-log.js';

describe('jobLog', () => {
  it('contains only safe queue and attempt fields', () => {
    expect(jobLog('job-123', 2, 'retry_scheduled')).toEqual({
      attempt: 2,
      jobId: 'job-123',
      outcome: 'retry_scheduled',
      queue: 'email',
    });
    expect(Object.keys(jobLog('job-123', 2, 'retry_scheduled'))).toEqual([
      'attempt',
      'jobId',
      'outcome',
      'queue',
    ]);
  });
});
