import { randomUUID } from 'node:crypto';

import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { aircraft, aircraftTransitReports, jobs, webhookCalls } from '@workspace/database/schema';
import { and, eq } from 'drizzle-orm';
import { ok } from 'neverthrow';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppModule } from '@/api/api.module.js';
import { setupSwagger } from '@/api/core/swagger/swagger.config.js';
import {
  AIRCRAFT_REPORT_QUEUE,
  QueueService,
  WEBHOOK_QUEUE,
} from '@/common/queue/queue.service.js';
import { SIMULATION_DELAY } from '@/modules/aircraft-transits/ports/simulation-delay.js';
import { CompleteJobUseCase } from '@/modules/jobs/use-case/complete-job.use-case.js';
import { WEBHOOK_CLIENT } from '@/modules/webhooks/ports/webhook-client.js';
import { WorkerModule } from '@/worker/worker.module.js';

import type { INestApplication } from '@nestjs/common';
import type { Database } from '@workspace/database/client';

// Requires a migrated and seeded database (pnpm run setup && pnpm db:seed).

const createdSchema = z.object({ data: z.object({ id: z.uuid(), startAt: z.iso.datetime() }) });
const jobSchema = z.object({
  data: z.object({
    activity: z.array(z.object({ attempt: z.number().nullable(), event: z.string() })),
    id: z.uuid(),
    result: z.record(z.string(), z.string()).nullable(),
    status: z.string(),
  }),
});

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

/** Ends the first completion of each registered job with a crash, after the side effect ran. */
class CrashOnceCompleteJobUseCase extends CompleteJobUseCase {
  static readonly crashFor = new Set<string>();

  override async execute(...args: Parameters<CompleteJobUseCase['execute']>): Promise<void> {
    if (CrashOnceCompleteJobUseCase.crashFor.delete(args[0])) {
      throw new Error('simulated worker crash before completion was recorded');
    }
    await super.execute(...args);
  }
}

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

const webhookBody = (overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: randomUUID(),
  payload: { payload: { hello: 'world' }, url: 'https://example.com/hook' },
  priority: 3,
  type: 'instant',
  ...overrides,
});

describe('webhook and aircraft report jobs', () => {
  let api: INestApplication;
  let database: Database;
  let queue: QueueService;
  let baseUrl: string;
  let aircraftId: string;

  const post = async (path: string, body: unknown): Promise<Response> =>
    fetch(`${baseUrl}/api/jobs/${path}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

  const getJob = async (id: string): Promise<z.infer<typeof jobSchema>['data']> => {
    const response = await fetch(`${baseUrl}/api/jobs/${id}`);
    return jobSchema.parse(await response.json()).data;
  };

  const waitFor = async (
    id: string,
    done: (job: z.infer<typeof jobSchema>['data']) => boolean,
  ): Promise<z.infer<typeof jobSchema>['data']> => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const job = await getJob(id);
      if (done(job)) return job;
      await sleep(250);
    }
    throw new Error('Job did not reach the expected state in 20 seconds.');
  };

  const reportBody = (overrides: Record<string, unknown> = {}) => ({
    idempotencyKey: randomUUID(),
    payload: {
      aircraftId,
      departureAt: new Date(Date.now() + 86_400_000).toISOString(),
      destinationIcao: 'KSFO',
      originIcao: 'RJTT',
    },
    priority: 3,
    type: 'instant',
    ...overrides,
  });

  const queues = [
    { body: webhookBody, name: WEBHOOK_QUEUE, path: 'webhook' },
    { body: reportBody, name: AIRCRAFT_REPORT_QUEUE, path: 'aircraft-report' },
  ] as const;

  /** Runs a worker whose first completion of the given job crashes, then expedites the retry. */
  const runCrashRetry = async (
    path: 'webhook' | 'aircraft-report',
    body: Record<string, unknown>,
  ): Promise<z.infer<typeof jobSchema>['data']> => {
    const workerModule = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(WEBHOOK_CLIENT)
      .useValue(reliableWebhookClient)
      .overrideProvider(SIMULATION_DELAY)
      .useValue(noDelay)
      .overrideProvider(CompleteJobUseCase)
      .useClass(CrashOnceCompleteJobUseCase)
      .compile();
    const worker = await workerModule.init();
    try {
      // Scheduled slightly ahead so the job is registered before any worker can claim it.
      const response = await post(path, {
        ...body,
        startAt: new Date(Date.now() + 3000).toISOString(),
        type: 'schedule',
      });
      const created = createdSchema.parse(await response.json());
      expect(response.status).toBe(202);
      CrashOnceCompleteJobUseCase.crashFor.add(created.data.id);
      await waitFor(created.data.id, (job) =>
        job.activity.some((e) => e.event === 'attempt_failed'),
      );
      const queueName = path === 'webhook' ? WEBHOOK_QUEUE : AIRCRAFT_REPORT_QUEUE;
      const expedited = await queue.boss.update(queueName, undefined, {
        id: created.data.id,
        startAfter: new Date(),
      });
      expect(expedited.updated).toBe(1);
      return await waitFor(created.data.id, (job) => job.status === 'completed');
    } finally {
      await worker.close();
    }
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
    const [plane] = await database.select({ id: aircraft.id }).from(aircraft).limit(1);
    if (!plane) throw new Error('Seed the database first: pnpm db:seed.');
    aircraftId = plane.id;
  }, 30_000);

  afterAll(async () => {
    await api?.close();
  });

  it.each(queues)(
    'rejects a repeated submission key on the $name queue',
    async ({ body, name, path }) => {
      const first = body();
      const firstResponse = await post(path, first);
      const created = createdSchema.parse(await firstResponse.json());
      expect(firstResponse.status).toBe(202);
      expect((await post(path, first)).status).toBe(409);
      expect((await post(path, { ...first, priority: 1 })).status).toBe(409);
      const [row] = await database.select().from(jobs).where(eq(jobs.id, created.data.id));
      expect(row?.queue).toBe(name);
      const [queued] = await queue.boss.findJobs(name, { id: created.data.id });
      expect(queued?.retryLimit).toBe(3);
      expect(queued?.retryDelay).toBe(60);
      expect(queued?.retryBackoff).toBe(true);
    },
  );

  it.each(queues)(
    'accepts one of two concurrent submissions on the $name queue',
    async ({ body, path }) => {
      const same = body();
      const responses = await Promise.all([post(path, same), post(path, same)]);
      expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
        202, 409,
      ]);
    },
  );

  it.each(queues)('schedules, then cancels once, a %s job', async ({ body, path }) => {
    const startAt = new Date(Date.now() + 120_000).toISOString();
    const response = await post(path, body({ startAt, type: 'schedule' }));
    const created = createdSchema.parse(await response.json());
    expect(created.data.startAt).toBe(startAt);
    const before = await getJob(created.data.id);
    expect(before.status).toBe('scheduled');
    expect(before.activity.map((event) => event.event)).toEqual(['created']);
    const cancelled = await fetch(`${baseUrl}/api/jobs/${created.data.id}`, { method: 'DELETE' });
    expect(cancelled.status).toBe(200);
    const again = await fetch(`${baseUrl}/api/jobs/${created.data.id}`, { method: 'DELETE' });
    expect(again.status).toBe(409);
    const after = await getJob(created.data.id);
    expect(after.status).toBe('cancelled');
    expect(after.activity.map((event) => event.event)).toEqual(['created', 'cancelled']);
  });

  it.each(queues)(
    'reports a repeated key before an elapsed schedule on the $name queue',
    async ({ body, path }) => {
      const same = body({ startAt: new Date(Date.now() + 1200).toISOString(), type: 'schedule' });
      expect((await post(path, same)).status).toBe(202);
      await sleep(1300);
      expect((await post(path, same)).status).toBe(409);
    },
  );

  it('rejects an invalid webhook URL and an invalid transit request with 400', async () => {
    const badUrl = await post(
      'webhook',
      webhookBody({ payload: { payload: {}, url: 'ftp://example.com' } }),
    );
    expect(badUrl.status).toBe(400);
    const unknownAirport = await post(
      'aircraft-report',
      reportBody({ payload: { ...reportBody().payload, originIcao: 'ZZZZ' } }),
    );
    expect(unknownAirport.status).toBe(400);
    const pastDeparture = await post(
      'aircraft-report',
      reportBody({ payload: { ...reportBody().payload, departureAt: '2001-01-01T00:00:00Z' } }),
    );
    expect(pastDeparture.status).toBe(400);
    const sameAirport = await post(
      'aircraft-report',
      reportBody({ payload: { ...reportBody().payload, destinationIcao: 'RJTT' } }),
    );
    expect(sameAirport.status).toBe(400);
  });

  it('documents the new routes in OpenAPI', async () => {
    const document = z
      .object({ paths: z.record(z.string(), z.unknown()) })
      .parse(await (await fetch(`${baseUrl}/api/docs-json`)).json());
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/api/jobs/webhook', '/api/jobs/aircraft-report']),
    );
  });

  it('delivers a webhook exactly once when the worker crashes before completion', async () => {
    const job = await runCrashRetry('webhook', webhookBody());
    expect(job.activity.map((event) => event.event)).toEqual([
      'created',
      'started',
      'attempt_failed',
      'started',
      'completed',
    ]);
    const calls = await database
      .select()
      .from(webhookCalls)
      .where(and(eq(webhookCalls.jobId, job.id), eq(webhookCalls.outcome, 'succeeded')));
    expect(calls).toHaveLength(1);
    expect(job.result).toEqual({ webhookCallId: calls[0]?.id });
  }, 40_000);

  it('generates exactly one report when the worker crashes before completion', async () => {
    const job = await runCrashRetry('aircraft-report', reportBody());
    expect(job.activity.map((event) => event.event)).toEqual([
      'created',
      'started',
      'attempt_failed',
      'started',
      'completed',
    ]);
    const reports = await database
      .select()
      .from(aircraftTransitReports)
      .where(eq(aircraftTransitReports.jobId, job.id));
    expect(reports).toHaveLength(1);
    expect(job.result).toEqual({ reportId: reports[0]?.id });
  }, 40_000);
});
