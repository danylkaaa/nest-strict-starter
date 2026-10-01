import { randomUUID } from 'node:crypto';

import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { aircraft, jobs } from '@workspace/database/schema';
import { eq, sql } from 'drizzle-orm';
import { err, ok } from 'neverthrow';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppModule } from '@/api/api.module.js';
import { setupSwagger } from '@/api/core/swagger/swagger.config.js';
import { QueueService, WEBHOOK_QUEUE } from '@/common/queue/queue.service.js';
import { SIMULATION_DELAY } from '@/modules/aircraft-transits/ports/simulation-delay.js';
import { WEBHOOK_CLIENT } from '@/modules/webhooks/ports/webhook-client.js';
import { WebhookDeliveryFailedError } from '@/modules/webhooks/webhook.errors.js';
import { WorkerModule } from '@/worker/worker.module.js';

import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import type { Database } from '@workspace/database/client';

// Requires a migrated and seeded database (pnpm run setup && pnpm db:seed) and no other worker
// consuming the same database.

const jobSchema = z.object({
  activity: z.array(z.object({ attempt: z.number().nullable(), event: z.string() })),
  attempts: z.number(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  id: z.uuid(),
  idempotencyKey: z.uuid(),
  lastErrorCategory: z.string().nullable(),
  maxAttempts: z.number(),
  payload: z.record(z.string(), z.unknown()),
  priority: z.number(),
  queue: z.string(),
  result: z.record(z.string(), z.string()).nullable(),
  startAt: z.string(),
  status: z.string(),
});
type JobResponse = z.infer<typeof jobSchema>;
const envelope = <T extends z.ZodType>(data: T) => z.object({ data, ok: z.literal(true) });
const createdSchema = envelope(z.object({ id: z.uuid(), startAt: z.string() }));
const listItemSchema = jobSchema.omit({ activity: true });
const pageSchema = envelope(
  z.object({
    items: z.array(listItemSchema),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
);
const statsSchema = envelope(
  z.object({
    counts: z.object({
      cancelled: z.number(),
      completed: z.number(),
      failed: z.number(),
      pending: z.number(),
      processing: z.number(),
      scheduled: z.number(),
    }),
    healthy: z.boolean(),
  }),
);
const conflictSchema = z.object({
  error: z.object({
    code: z.string(),
    details: z.object({ existingJobId: z.uuid() }),
    message: z.string(),
  }),
  ok: z.literal(false),
});
const reportSchema = envelope(
  z.object({
    aircraft: z.object({ id: z.string() }),
    arrivalAt: z.string(),
    departureAt: z.string(),
    destination: z.object({ icao: z.string() }),
    distanceKm: z.number(),
    durationMinutes: z.number(),
    id: z.string(),
    origin: z.object({ icao: z.string() }),
    waypoints: z.array(
      z.object({
        altitudeM: z.number(),
        latitude: z.number(),
        longitude: z.number(),
        speedKmh: z.number(),
        timestamp: z.string(),
      }),
    ),
  }),
);

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const failingWebhookClient = { call: () => Promise.resolve(err(new WebhookDeliveryFailedError())) };
const reliableWebhookClient = {
  call: () =>
    Promise.resolve(
      ok({
        body: { accepted: true, value: 42 },
        requestId: 'mock_fixed',
        status: 'delivered',
      } as const),
    ),
};
const noDelay = { wait: () => Promise.resolve() };

const webhookBody = (tag: string, overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: randomUUID(),
  payload: { payload: { tag }, url: `https://example.com/${tag}` },
  priority: 3,
  type: 'instant',
  ...overrides,
});

/** Runs the worker with the given webhook client for the duration of `run`. */
const withWorker = async <T>(
  client: typeof failingWebhookClient | typeof reliableWebhookClient,
  run: () => Promise<T>,
): Promise<T> => {
  const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(WEBHOOK_CLIENT)
    .useValue(client)
    .overrideProvider(SIMULATION_DELAY)
    .useValue(noDelay)
    .compile();
  const worker: INestApplicationContext = await moduleRef.init();
  try {
    return await run();
  } finally {
    await worker.close();
  }
};

describe('job management API', () => {
  let api: INestApplication;
  let database: Database;
  let queue: QueueService;
  let baseUrl: string;

  const post = async (path: string, body?: unknown): Promise<Response> =>
    fetch(`${baseUrl}/api/${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

  const submitWebhook = async (
    tag: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const response = await post('jobs/webhook', webhookBody(tag, overrides));
    expect(response.status).toBe(202);
    return createdSchema.parse(await response.json()).data.id;
  };

  const getJob = async (id: string): Promise<JobResponse> => {
    const response = await fetch(`${baseUrl}/api/jobs/${id}`);
    expect(response.status).toBe(200);
    return envelope(jobSchema).parse(await response.json()).data;
  };

  const list = async (query: Record<string, string>) => {
    const response = await fetch(`${baseUrl}/api/jobs?${new URLSearchParams(query).toString()}`);
    expect(response.status).toBe(200);
    return pageSchema.parse(await response.json()).data;
  };

  const waitFor = async (id: string, done: (job: JobResponse) => boolean): Promise<JobResponse> => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const job = await getJob(id);
      if (done(job)) return job;
      await sleep(250);
    }
    throw new Error('Job did not reach the expected state in 20 seconds.');
  };

  const expedite = async (id: string): Promise<void> => {
    const result = await queue.boss.update(WEBHOOK_QUEUE, undefined, {
      id,
      startAfter: new Date(),
    });
    expect(result.updated).toBe(1);
  };

  beforeAll(async () => {
    const apiModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    api = apiModule.createNestApplication({ logger: false });
    api.setGlobalPrefix('api');
    setupSwagger(api);
    await api.listen(0, '127.0.0.1');
    baseUrl = await api.getUrl();
    database = api.get<Database>(getDrizzleToken());
    queue = api.get(QueueService);
  }, 30_000);

  afterAll(async () => {
    await api?.close();
  });

  describe('submission', () => {
    it('stores the payload and maxAttempts on the job and sets the queue retry limit', async () => {
      const tag = `store-${randomUUID()}`;
      const id = await submitWebhook(tag, { maxAttempts: 6 });
      const job = await getJob(id);
      expect(job).toMatchObject({
        attempts: 0,
        completedAt: null,
        lastErrorCategory: null,
        maxAttempts: 6,
        payload: { method: 'POST', payload: { tag }, url: `https://example.com/${tag}` },
        priority: 3,
        queue: 'webhook',
        result: null,
        status: 'pending',
      });
      const [queued] = await queue.boss.findJobs(WEBHOOK_QUEUE, { id });
      expect(queued?.retryLimit).toBe(5);
    });

    it('defaults maxAttempts to 4 and rejects values outside 1 to 10', async () => {
      const job = await getJob(await submitWebhook(`default-${randomUUID()}`));
      expect(job.maxAttempts).toBe(4);
      for (const maxAttempts of [0, 11]) {
        const response = await post('jobs/webhook', webhookBody('bad', { maxAttempts }));
        expect(response.status).toBe(400);
      }
    });

    it('returns the existing job ID in the 409 details', async () => {
      const body = webhookBody(`conflict-${randomUUID()}`);
      const first = createdSchema.parse(await (await post('jobs/webhook', body)).json());
      const again = await post('jobs/webhook', { ...body, priority: 1 });
      expect(again.status).toBe(409);
      const conflict = conflictSchema.parse(await again.json());
      expect(conflict.error.code).toBe('JobConflictError');
      expect(conflict.error.message).toBe('The idempotency key was already used.');
      expect(conflict.error.details.existingJobId).toBe(first.data.id);
    });
  });

  describe('list and stats', () => {
    it('filters, searches, orders, and paginates with correct totals', async () => {
      const tag = `list-${randomUUID()}`;
      const first = await submitWebhook(`${tag}-a`);
      const second = await submitWebhook(`${tag}-b`, {
        startAt: new Date(Date.now() + 120_000).toISOString(),
        type: 'schedule',
      });
      const third = await submitWebhook(`${tag}-c`);
      const cancelled = await fetch(`${baseUrl}/api/jobs/${third}`, { method: 'DELETE' });
      expect(cancelled.status).toBe(200);

      const all = await list({ pageSize: '100', search: tag });
      expect(all.total).toBe(3);
      expect(all.totalPages).toBe(1);
      expect(all.items.map((item) => item.id)).toEqual([third, second, first]);
      expect(all.items.map((item) => item.status)).toEqual(['cancelled', 'scheduled', 'pending']);
      expect(all.items[0]?.completedAt).not.toBeNull();
      expect(all.items[2]?.completedAt).toBeNull();

      const upper = await list({ search: tag.toUpperCase() });
      expect(upper.total).toBe(3);
      const byId = await list({ search: second.slice(0, 13) });
      expect(byId.items.map((item) => item.id)).toContain(second);

      const filtered = await list({ search: tag, status: 'pending,scheduled' });
      expect(filtered.items.map((item) => item.id)).toEqual([second, first]);
      expect(filtered.total).toBe(2);
      expect((await list({ queue: 'email', search: tag })).total).toBe(0);
      expect((await list({ queue: 'webhook', search: tag, status: 'cancelled' })).total).toBe(1);

      const pageOne = await list({ page: '1', pageSize: '2', search: tag });
      const pageTwo = await list({ page: '2', pageSize: '2', search: tag });
      expect(pageOne).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
      expect(pageOne.items.map((item) => item.id)).toEqual([third, second]);
      expect(pageTwo.items.map((item) => item.id)).toEqual([first]);

      const invalid = await fetch(`${baseUrl}/api/jobs?pageSize=101`);
      expect(invalid.status).toBe(400);
      const badStatus = await fetch(`${baseUrl}/api/jobs?status=nope`);
      expect(badStatus.status).toBe(400);
    });

    it('shows a scheduled job whose start has passed as pending without writing it', async () => {
      const tag = `effective-${randomUUID()}`;
      const id = await submitWebhook(tag, {
        startAt: new Date(Date.now() + 1500).toISOString(),
        type: 'schedule',
      });
      expect((await list({ search: tag, status: 'scheduled' })).total).toBe(1);
      const statsBefore = statsSchema.parse(
        await (await fetch(`${baseUrl}/api/jobs/stats`)).json(),
      ).data;
      await sleep(1800);
      expect((await list({ search: tag, status: 'scheduled' })).total).toBe(0);
      const pending = await list({ search: tag, status: 'pending' });
      expect(pending.items.map((item) => item.status)).toEqual(['pending']);
      const [row] = await database
        .select({ status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, id));
      expect(row?.status).toBe('scheduled');
      const statsAfter = statsSchema.parse(
        await (await fetch(`${baseUrl}/api/jobs/stats`)).json(),
      ).data;
      expect(statsAfter.counts.scheduled).toBe(statsBefore.counts.scheduled - 1);
      expect(statsAfter.counts.pending).toBe(statsBefore.counts.pending + 1);
    });

    it('counts every status, always present, and reports health', async () => {
      const response = await fetch(`${baseUrl}/api/jobs/stats`);
      expect(response.status).toBe(200);
      const stats = statsSchema.parse(await response.json()).data;
      expect(Object.keys(stats.counts).toSorted()).toEqual([
        'cancelled',
        'completed',
        'failed',
        'pending',
        'processing',
        'scheduled',
      ]);
      const [total] = await database.select({ total: sql<number>`count(*)::int` }).from(jobs);
      expect(Object.values(stats.counts).reduce((sum, count) => sum + count, 0)).toBe(total?.total);
      expect(stats.healthy).toBe(true);
    });
  });

  describe('attempts and retry', () => {
    beforeAll(async () => {
      // Earlier read-side cases leave eligible submissions behind. The worker in these cases
      // should spend its time on the job under test, not retry that earlier queue backlog.
      for (const queued of await queue.boss.findJobs(WEBHOOK_QUEUE)) {
        if (queued.state === 'created' || queued.state === 'retry')
          await queue.boss.cancel(WEBHOOK_QUEUE, queued.id);
      }
    });

    it('fails terminally after one attempt when maxAttempts is 1', async () => {
      const id = await submitWebhook(`one-${randomUUID()}`, { maxAttempts: 1 });
      const job = await withWorker(failingWebhookClient, async () =>
        waitFor(id, (current) => current.status === 'failed'),
      );
      expect(job).toMatchObject({
        attempts: 1,
        lastErrorCategory: 'delivery_failed',
        maxAttempts: 1,
      });
      expect(job.completedAt).not.toBeNull();
      expect(job.activity.map((event) => event.event)).toEqual([
        'created',
        'started',
        'attempt_failed',
        'failed',
      ]);
    }, 30_000);

    it('fails terminally after two attempts when maxAttempts is 2', async () => {
      const id = await submitWebhook(`two-${randomUUID()}`, { maxAttempts: 2 });
      const job = await withWorker(failingWebhookClient, async () => {
        await waitFor(id, (current) => current.activity.some((e) => e.event === 'attempt_failed'));
        await expedite(id);
        return waitFor(id, (current) => current.status === 'failed');
      });
      expect(job.attempts).toBe(2);
      expect(job.activity.map((event) => event.event)).toEqual([
        'created',
        'started',
        'attempt_failed',
        'started',
        'attempt_failed',
        'failed',
      ]);
    }, 40_000);

    it('retries a failed job once more, then completes it', async () => {
      const id = await submitWebhook(`retry-${randomUUID()}`, { maxAttempts: 1 });
      await withWorker(failingWebhookClient, async () =>
        waitFor(id, (current) => current.status === 'failed'),
      );

      const response = await post(`jobs/${id}/retry`);
      expect(response.status).toBe(200);
      const retried = envelope(jobSchema).parse(await response.json()).data;
      expect(retried).toMatchObject({ completedAt: null, maxAttempts: 2, status: 'pending' });
      expect(retried.activity.at(-1)).toEqual({ attempt: 2, event: 'retried' });
      const [queued] = await queue.boss.findJobs(WEBHOOK_QUEUE, { id });
      expect(queued?.retryLimit).toBe(1);
      expect((await list({ search: id, status: 'pending' })).total).toBe(1);

      const completed = await withWorker(reliableWebhookClient, async () =>
        waitFor(id, (current) => current.status === 'completed'),
      );
      expect(completed).toMatchObject({ attempts: 2, maxAttempts: 2 });
      expect(completed.result).toHaveProperty('webhookCallId');
      expect(completed.activity.map((event) => `${event.event}:${event.attempt}`)).toEqual([
        'created:null',
        'started:1',
        'attempt_failed:1',
        'failed:1',
        'retried:2',
        'started:2',
        'completed:2',
      ]);

      expect((await post(`jobs/${id}/retry`)).status).toBe(409);
    }, 40_000);

    it('continues attempt numbering when a job that used all its attempts is retried', async () => {
      const id = await submitWebhook(`numbering-${randomUUID()}`, { maxAttempts: 2 });
      const job = await withWorker(failingWebhookClient, async () => {
        await waitFor(id, (current) => current.activity.some((e) => e.event === 'attempt_failed'));
        await expedite(id);
        await waitFor(id, (current) => current.status === 'failed');
        const response = await post(`jobs/${id}/retry`);
        expect(response.status).toBe(200);
        return waitFor(
          id,
          (current) => current.activity.filter((event) => event.event === 'failed').length === 2,
        );
      });
      expect(job.maxAttempts).toBe(3);
      expect(job.activity.map((event) => `${event.event}:${event.attempt}`)).toEqual([
        'created:null',
        'started:1',
        'attempt_failed:1',
        'started:2',
        'attempt_failed:2',
        'failed:2',
        'retried:3',
        'started:3',
        'attempt_failed:3',
        'failed:3',
      ]);
    }, 60_000);

    it('answers 404 for an unknown job and 409 for a job that has not failed', async () => {
      expect((await post(`jobs/${randomUUID()}/retry`)).status).toBe(404);
      const id = await submitWebhook(`not-failed-${randomUUID()}`);
      const response = await post(`jobs/${id}/retry`);
      expect(response.status).toBe(409);
      const body = z.object({ error: z.object({ code: z.string() }) }).parse(await response.json());
      expect(body.error.code).toBe('JobNotRetryableError');
      expect((await getJob(id)).maxAttempts).toBe(4);
    });

    it('grants exactly one attempt when two retries race', async () => {
      const id = await submitWebhook(`race-${randomUUID()}`, { maxAttempts: 1 });
      await withWorker(failingWebhookClient, async () =>
        waitFor(id, (current) => current.status === 'failed'),
      );
      const responses = await Promise.all([post(`jobs/${id}/retry`), post(`jobs/${id}/retry`)]);
      expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      const job = await getJob(id);
      expect(job.maxAttempts).toBe(2);
      expect(job.activity.filter((event) => event.event === 'retried')).toHaveLength(1);
    }, 30_000);

    it('does not retry a job whose queue row changed while the retry waited on its lock', async () => {
      const id = await submitWebhook(`lock-${randomUUID()}`, { maxAttempts: 1 });
      await withWorker(failingWebhookClient, async () =>
        waitFor(id, (current) => current.status === 'failed'),
      );
      const locked = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const competing = database.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT id FROM pgboss.job WHERE name = ${WEBHOOK_QUEUE} AND id = ${id}::uuid FOR UPDATE`,
        );
        locked.resolve();
        await release.promise;
        await tx.execute(
          sql`UPDATE pgboss.job SET state = 'active' WHERE name = ${WEBHOOK_QUEUE} AND id = ${id}::uuid`,
        );
      });
      await locked.promise;
      const retrying = post(`jobs/${id}/retry`);
      await sleep(200);
      release.resolve();
      await competing;
      expect((await retrying).status).toBe(409);
      const [row] = await database.select().from(jobs).where(eq(jobs.id, id));
      expect(row).toMatchObject({ maxAttempts: 1, status: 'failed' });
      await database.execute(
        sql`UPDATE pgboss.job SET state = 'failed' WHERE name = ${WEBHOOK_QUEUE} AND id = ${id}::uuid`,
      );
    }, 30_000);
  });

  describe('aircraft transit reports', () => {
    it('serves the report named by the aircraft report job result', async () => {
      const [plane] = await database.select({ id: aircraft.id }).from(aircraft).limit(1);
      const body = {
        idempotencyKey: randomUUID(),
        payload: {
          aircraftId: plane?.id,
          departureAt: new Date(Date.now() + 86_400_000).toISOString(),
          destinationIcao: 'KSFO',
          originIcao: 'RJTT',
        },
        priority: 3,
        type: 'instant',
      };
      const created = createdSchema.parse(await (await post('jobs/aircraft-report', body)).json());
      const job = await withWorker(reliableWebhookClient, async () =>
        waitFor(created.data.id, (current) => current.status === 'completed'),
      );
      const reportId = job.result?.['reportId'];
      expect(reportId).toMatch(/^atr_/u);

      const response = await fetch(`${baseUrl}/api/aircraft-transit-reports/${reportId}`);
      expect(response.status).toBe(200);
      const report = reportSchema.parse(await response.json()).data;
      expect(report).toMatchObject({
        aircraft: { id: plane?.id },
        destination: { icao: 'KSFO' },
        id: reportId,
        origin: { icao: 'RJTT' },
      });
      expect(report.distanceKm).toBeGreaterThan(0);
      expect(report.waypoints.length).toBeGreaterThan(1);
      expect(report.waypoints[0]?.timestamp).toBe(report.departureAt);

      const missing = await fetch(`${baseUrl}/api/aircraft-transit-reports/atr_missing`);
      expect(missing.status).toBe(404);
    }, 40_000);
  });
});
