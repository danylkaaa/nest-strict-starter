import type { JobStatus } from '@/modules/jobs/job.js';

export type CheckState = 'up' | 'down';

export interface HealthReport {
  /** `ok` only when every check is up. */
  status: 'ok' | 'down';
  checks: { database: CheckState; queue: CheckState };
  /** All zeros while the database is down. */
  counts: Record<JobStatus, number>;
}
