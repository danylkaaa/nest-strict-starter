import { beforeEach, describe, expect, it } from 'vitest';

import { ApiError } from '@/shared/api-error';

import { backoffMs, createMockServer, type MockServer } from './mock-server';

import type { SubmitJobInput } from '@/features/jobs/job';

const email: SubmitJobInput = {
  payload: { body: 'Hi', subject: 'Welcome', to: 'ana@example.com' },
  type: 'email',
};
const webhook: SubmitJobInput = {
  payload: { body: { orderId: 1 }, method: 'POST', url: 'https://hooks.example.com/orders' },
  type: 'webhook',
};

const emailTask = { payload: email.payload, type: 'email' } as const;
const tasks = (count: number) => Array.from({ length: count }, () => emailTask);

let now = 0;
let randomValue = 0.5;
let server: MockServer;

const advance = (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 1000) {
    now += 1000;
    server.tick();
  }
};

const setup = (workers = 3) => {
  server = createMockServer({ now: () => now, random: () => randomValue, workers });
};

describe('mock server', () => {
  beforeEach(() => {
    now = Date.UTC(2026, 9, 1, 12);
    randomValue = 0.5;
    setup();
  });

  describe('submit', () => {
    it('queues a job without runAt as pending', () => {
      const { created, job } = server.submitJob(email);

      expect(created).toBe(true);
      expect(job).toMatchObject({ attempts: 0, maxAttempts: 3, priority: 0, status: 'pending' });
      expect(job.id).toMatch(/^job_[\da-z]{8}$/u);
    });

    it('schedules a job with a future runAt and releases it when due', () => {
      const runAt = new Date(now + 5000).toISOString();
      const { job } = server.submitJob({ ...email, runAt });

      expect(job.status).toBe('scheduled');
      advance(4000);
      expect(server.getJob(job.id).status).toBe('scheduled');
      advance(1000);
      expect(server.getJob(job.id).status).not.toBe('scheduled');
    });

    it('returns the existing job for a reused idempotency key', () => {
      const first = server.submitJob({ ...email, idempotencyKey: 'order-1' });
      const second = server.submitJob({ ...webhook, idempotencyKey: 'order-1' });

      expect(second).toEqual({ created: false, job: first.job });
      expect(server.listJobs({ page: 1, pageSize: 10 }).total).toBe(1);
    });

    it('rejects an empty batch', () => {
      expect(() => server.submitJob({ payload: { items: [] }, type: 'batch' })).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    });

    it('rejects a batch with an invalid task', () => {
      expect(() =>
        server.submitJob({
          payload: {
            items: [
              emailTask,
              {
                payload: {
                  departureAt: '2026-10-03T09:00:00.000Z',
                  destination: 'XXX',
                  origin: 'JFK',
                },
                type: 'transit',
              },
            ],
          },
          type: 'batch',
        }),
      ).toThrow(expect.objectContaining({ message: 'Task 2: Unknown airport code' }));
    });

    it('rejects a transit report for an unknown airport', () => {
      expect(() =>
        server.submitJob({
          payload: { departureAt: '2026-10-03T09:00:00.000Z', destination: 'XXX', origin: 'JFK' },
          type: 'transit',
        }),
      ).toThrow(ApiError);
    });
  });

  describe('pickup', () => {
    it('picks the highest priority job first', () => {
      setup(1);
      const low = server.submitJob({ ...email, priority: 1 }).job;
      const high = server.submitJob({ ...email, priority: 9 }).job;

      advance(1000);

      expect(server.getJob(high.id)).toMatchObject({ attempts: 1, status: 'processing' });
      expect(server.getJob(low.id).status).toBe('pending');
    });

    it('never runs more jobs than there are workers', () => {
      for (let index = 0; index < 5; index += 1) server.submitJob(email);

      advance(1000);

      expect(server.getHealth()).toMatchObject({
        counts: { pending: 2, processing: 3 },
        workers: { busy: 3, total: 3 },
      });
    });
  });

  describe('processing', () => {
    it('completes an email with a message id', () => {
      const { job } = server.submitJob(email);

      advance(5000);

      const done = server.getJob(job.id);
      expect(done).toMatchObject({ progress: 100, status: 'completed' });
      expect(done.result).toEqual({ messageId: expect.stringMatching(/^msg_/u) });
      expect(done.completedAt).not.toBeNull();
    });

    it('retries a failing webhook with backoff, then marks it failed', () => {
      randomValue = 0.1;
      const { job } = server.submitJob(webhook);

      advance(3000);
      const retrying = server.getJob(job.id);
      expect(retrying).toMatchObject({ attempts: 1, status: 'scheduled' });
      expect(retrying.attemptHistory[0]).toMatchObject({ next: 'retry in 5s', outcome: 503 });

      advance(60_000);
      const failed = server.getJob(job.id);
      expect(failed).toMatchObject({ attempts: 3, status: 'failed' });
      expect(failed.error).toContain('503');
      expect(failed.attemptHistory.map((attempt) => attempt.next)).toEqual([
        'retry in 5s',
        'retry in 15s',
        'gave up',
      ]);
    });

    it('processes batch items and completes with a summary', () => {
      const { job } = server.submitJob({ payload: { items: tasks(6) }, type: 'batch' });

      advance(2000);
      const running = server.getJob(job.id);
      expect(running.status).toBe('processing');
      expect(running.progress).toBeGreaterThan(0);
      expect(running.progress).toBeLessThan(100);

      advance(10_000);
      const done = server.getJob(job.id);
      expect(done).toMatchObject({
        progress: 100,
        result: { failed: 0, processed: 6, succeeded: 6 },
        status: 'completed',
      });
      expect(done.attemptHistory).toEqual([
        expect.objectContaining({ finishedAt: expect.any(String), outcome: 200 }),
      ]);
    });

    it('runs each batch task with its own type handler', () => {
      const { job } = server.submitJob({
        payload: {
          items: [
            emailTask,
            {
              payload: { body: {}, method: 'POST', url: 'https://httpstat.us/503' },
              type: 'webhook',
            },
            { payload: { ...email.payload, to: 'ghost@bounce.test' }, type: 'email' },
          ],
        },
        type: 'batch',
      });

      advance(5000);
      const done = server.getJob(job.id);

      expect(done).toMatchObject({
        batchItems: ['done', 'failed', 'failed'],
        result: { failed: 2, processed: 3, succeeded: 1 },
        status: 'completed',
      });
      expect(done.logs.map((entry) => entry.message)).toContain(
        'Task 2 (webhook) failed: Webhook returned 503 Service Unavailable',
      );
    });

    it('builds a transit report with a great-circle path', () => {
      const { job } = server.submitJob({
        payload: { departureAt: '2026-10-03T09:00:00.000Z', destination: 'LHR', origin: 'JFK' },
        type: 'transit',
      });

      advance(10_000);
      const done = server.getJob(job.id);

      expect(done).toMatchObject({
        result: {
          destination: { code: 'LHR' },
          distanceKm: expect.closeTo(5540, -1),
          origin: { code: 'JFK' },
        },
        status: 'completed',
      });
      expect(done).toHaveProperty('result.path.32.fraction', 1);
    });
  });

  describe('cancel and retry', () => {
    it('cancels a pending job', () => {
      const { job } = server.submitJob(email);

      expect(server.cancelJob(job.id).status).toBe('cancelled');
      advance(5000);
      expect(server.getJob(job.id).status).toBe('cancelled');
    });

    it('closes the running attempt when a processing batch is cancelled', () => {
      const { job } = server.submitJob({ payload: { items: tasks(30) }, type: 'batch' });
      advance(2000);

      const cancelled = server.cancelJob(job.id);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.attemptHistory[0]).toMatchObject({
        finishedAt: expect.any(String),
        next: 'cancelled',
        outcome: null,
      });
    });

    it('refuses to cancel a completed job', () => {
      const { job } = server.submitJob(email);
      advance(5000);

      expect(() => server.cancelJob(job.id)).toThrow(
        expect.objectContaining({ code: 'INVALID_STATE' }),
      );
    });

    it('retries a failed job from zero attempts', () => {
      randomValue = 0.1;
      const { job } = server.submitJob(webhook);
      advance(60_000);

      const retried = server.retryJob(job.id);

      expect(retried).toMatchObject({ attempts: 0, error: null, status: 'pending' });
    });

    it('refuses to retry a job that has not failed', () => {
      const { job } = server.submitJob(email);

      expect(() => server.retryJob(job.id)).toThrow(
        expect.objectContaining({ code: 'INVALID_STATE' }),
      );
    });
  });

  describe('queries', () => {
    it('filters jobs by status and type, newest first', () => {
      server.submitJob(email);
      now += 1000;
      const newer = server.submitJob(webhook).job;

      expect(server.listJobs({ page: 1, pageSize: 10, type: 'webhook' }).items).toEqual([newer]);
      expect(server.listJobs({ page: 1, pageSize: 10 }).items[0]?.id).toBe(newer.id);
      expect(server.listJobs({ page: 1, pageSize: 10, status: 'failed' }).total).toBe(0);
    });

    it('lists finished email jobs as sent emails', () => {
      server.submitJob(email);
      advance(5000);

      expect(server.listEmails({ page: 1, pageSize: 10 }).items).toEqual([
        expect.objectContaining({ status: 'sent', subject: 'Welcome', to: 'ana@example.com' }),
      ]);
    });

    it('throws NOT_FOUND for an unknown job', () => {
      expect(() => server.getJob('job_missing')).toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    });
  });
});

describe('backoffMs', () => {
  it('triples from 5 seconds', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([5000, 15_000, 45_000]);
  });
});
