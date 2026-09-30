import { describe, expect, it } from 'vitest';

import { jobLog } from './job-log.js';

describe('jobLog', () => {
  it.each(['email', 'webhook', 'aircraft-report'] as const)(
    'contains only safe queue and attempt fields for %s',
    (queue) => {
      expect(jobLog(queue, 'job-123', 2, 'retry_scheduled')).toEqual({
        attempt: 2,
        jobId: 'job-123',
        outcome: 'retry_scheduled',
        queue,
      });
      expect(Object.keys(jobLog(queue, 'job-123', 2, 'retry_scheduled'))).toEqual([
        'attempt',
        'jobId',
        'outcome',
        'queue',
      ]);
    },
  );
});
