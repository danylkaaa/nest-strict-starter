import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HEALTH_CHECKS } from '@/modules/health/ports/health-checks.js';
import { CountJobsByStatusUseCase } from '@/modules/jobs/use-case/count-jobs-by-status.use-case.js';

import { CheckHealthUseCase } from './check-health.use-case.js';

import type { HealthChecks } from '@/modules/health/ports/health-checks.js';
import type { JobStatus } from '@/modules/jobs/job.js';

const counts = {
  cancelled: 1,
  completed: 4,
  failed: 2,
  pending: 3,
  processing: 5,
  scheduled: 6,
};
const zeros = {
  cancelled: 0,
  completed: 0,
  failed: 0,
  pending: 0,
  processing: 0,
  scheduled: 0,
};

const setup = async () => {
  const checks = {
    pingDatabase: vi.fn<HealthChecks['pingDatabase']>().mockResolvedValue(),
    pingQueue: vi.fn<HealthChecks['pingQueue']>().mockResolvedValue(),
  };
  const countJobs = vi.fn<CountJobsByStatusUseCase['execute']>().mockResolvedValue(counts);
  const module = await Test.createTestingModule({
    providers: [
      CheckHealthUseCase,
      { provide: HEALTH_CHECKS, useValue: checks },
      { provide: CountJobsByStatusUseCase, useValue: { execute: countJobs } },
    ],
  }).compile();
  return { checks, countJobs, useCase: module.get(CheckHealthUseCase) };
};

describe('check health use case', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is ok with the job counts when the database and queue answer', async () => {
    const { useCase } = await setup();
    await expect(useCase.execute()).resolves.toEqual({
      checks: { database: 'up', queue: 'up' },
      counts,
      status: 'ok',
    });
  });

  it('is down with zero counts when the database does not answer', async () => {
    const { checks, countJobs, useCase } = await setup();
    checks.pingDatabase.mockRejectedValue(new Error('password authentication failed for app'));
    await expect(useCase.execute()).resolves.toEqual({
      checks: { database: 'down', queue: 'up' },
      counts: zeros,
      status: 'down',
    });
    expect(countJobs).not.toHaveBeenCalled();
  });

  it('is down with the real counts when only the queue does not answer', async () => {
    const { checks, useCase } = await setup();
    checks.pingQueue.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    await expect(useCase.execute()).resolves.toEqual({
      checks: { database: 'up', queue: 'down' },
      counts,
      status: 'down',
    });
  });

  it('marks the database down when the counts cannot be read', async () => {
    const { countJobs, useCase } = await setup();
    countJobs.mockRejectedValue(new Error('relation "jobs" does not exist'));
    await expect(useCase.execute()).resolves.toEqual({
      checks: { database: 'down', queue: 'up' },
      counts: zeros,
      status: 'down',
    });
  });

  it('gives up on a queue that hangs after 2 seconds and still reports the real counts', async () => {
    const { checks, useCase } = await setup();
    checks.pingQueue.mockReturnValue(Promise.withResolvers<void>().promise);
    const report = useCase.execute();
    await vi.advanceTimersByTimeAsync(1999);
    const pending = Symbol('pending');
    await expect(Promise.race([report, Promise.resolve(pending)])).resolves.toBe(pending);
    await vi.advanceTimersByTimeAsync(1);
    await expect(report).resolves.toEqual({
      checks: { database: 'up', queue: 'down' },
      counts,
      status: 'down',
    });
  });

  it('gives up on counts that hang and marks the database down', async () => {
    const { countJobs, useCase } = await setup();
    countJobs.mockReturnValue(Promise.withResolvers<Record<JobStatus, number>>().promise);
    const report = useCase.execute();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(report).resolves.toEqual({
      checks: { database: 'down', queue: 'up' },
      counts: zeros,
      status: 'down',
    });
  });

  it('never leaks the underlying error text', async () => {
    const { checks, useCase } = await setup();
    checks.pingDatabase.mockRejectedValue(new Error('secret-host-name'));
    checks.pingQueue.mockRejectedValue(new Error('secret-queue-detail'));
    const report = await useCase.execute();
    expect(JSON.stringify(report)).not.toContain('secret');
  });
});
