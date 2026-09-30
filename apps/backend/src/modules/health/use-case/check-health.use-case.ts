import { Inject, Injectable } from '@nestjs/common';

import { HEALTH_CHECKS } from '@/modules/health/ports/health-checks.js';
import { CountJobsByStatusUseCase } from '@/modules/jobs/use-case/count-jobs-by-status.use-case.js';

import type { CheckState, HealthReport } from '@/modules/health/health.js';
import type { HealthChecks } from '@/modules/health/ports/health-checks.js';

export const CHECK_TIMEOUT_MS = 2000;

const ZERO_COUNTS: HealthReport['counts'] = {
  cancelled: 0,
  completed: 0,
  failed: 0,
  pending: 0,
  processing: 0,
  scheduled: 0,
};

const TIMED_OUT = Symbol('timed out');

/** The result of `work`, or undefined when it fails or takes longer than the timeout. */
const within = async <T>(work: () => Promise<T>): Promise<Awaited<T> | undefined> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => {
      resolve(TIMED_OUT);
    }, CHECK_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([work(), timeout]);
    return result === TIMED_OUT ? undefined : result;
  } catch {
    // The error text is dropped on purpose: it can name hosts or credentials.
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};

const stateOf = (answered: boolean): CheckState => (answered ? 'up' : 'down');

@Injectable()
export class CheckHealthUseCase {
  constructor(
    @Inject(HEALTH_CHECKS) private readonly checks: HealthChecks,
    private readonly countJobs: CountJobsByStatusUseCase,
  ) {}

  async execute(): Promise<HealthReport> {
    const [databaseAnswered, queueAnswered] = await Promise.all([
      within(async () => {
        await this.checks.pingDatabase();
        return true;
      }),
      within(async () => {
        await this.checks.pingQueue();
        return true;
      }),
    ]);
    // Counts need the database; a failure here means it is not usable even if the ping passed.
    const counts = databaseAnswered
      ? await within(async () => this.countJobs.execute())
      : undefined;
    const checks = {
      database: stateOf(counts !== undefined),
      queue: stateOf(queueAnswered === true),
    };
    return {
      checks,
      counts: counts ?? ZERO_COUNTS,
      status: checks.database === 'up' && checks.queue === 'up' ? 'ok' : 'down',
    };
  }
}
