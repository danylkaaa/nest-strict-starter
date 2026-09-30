import { randomUUID } from 'node:crypto';

import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { aircraft, jobActivity, jobBatches, jobs } from '@workspace/database/schema';
import { asc, eq, isNotNull, sql } from 'drizzle-orm';
import { err, ok } from 'neverthrow';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AppModule } from '@/api/api.module.js';
import { setupSwagger } from '@/api/core/swagger/swagger.config.js';
import { QueueService } from '@/common/queue/queue.service.js';
import { SIMULATION_DELAY } from '@/modules/aircraft-transits/ports/simulation-delay.js';
import { EMAIL_CLIENT } from '@/modules/emails/ports/email-client.js';
import { FailJobAttemptUseCase } from '@/modules/jobs/use-case/fail-job-attempt.use-case.js';
import { WEBHOOK_CLIENT } from '@/modules/webhooks/ports/webhook-client.js';
import { WebhookDeliveryFailedError } from '@/modules/webhooks/webhook.errors.js';
import { WorkerModule } from '@/worker/worker.module.js';

import type { QueueName } from '@/common/queue/queue.service.js';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '@workspace/database/client';

// Requires a migrated and seeded disposable database (pnpm run setup && pnpm db:seed) and no
// other workers running on it: any worker consumes every queue.

const createdSchema = z.object({ data: z.object({ id: z.uuid(), startAt: z.iso.datetime() }) });
const batchSchema = z.object({
  data: z.object({
    cancellationRequestedAt: z.string().nullable(),
    counts: z.record(z.string(), z.number()),
    id: z.uuid(),
    items: z.array(
      z.object({
        id: z.uuid(),
        link: z.string(),
        position: z.number(),
        queue: z.string(),
        result: z.record(z.string(), z.string()).nullable(),
        status: z.string(),
      }),
    ),
    progress: z.number(),
    status: z.string(),
    total: z.number(),
  }),
});
const errorSchema = z.object({
  error: z.object({ code: z.string(), details: z.record(z.string(), z.unknown()).optional() }),
});

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const emailItem = {
  payload: { body: 'Hi', recipient: 'a@example.com', subject: 'Hi' },
  type: 'email',
};
const webhookItem = {
  payload: { payload: { hello: 'world' }, url: 'https://example.com/hook' },
  type: 'webhook',
};

const emailClient = { send: () => Promise.resolve(ok({ messageId: `msg_${randomUUID()}` })) };
/** Delivers every webhook except one to a URL ending in /fail. */
const webhookClient = {
  call: (input: { url: string }) =>
    Promise.resolve(
      input.url.endsWith('/fail')
        ? err(new WebhookDeliveryFailedError())
        : ok({
            body: { accepted: true, value: 1 },
            requestId: 'mock_1',
            status: 'delivered',
          } as const),
    ),
};

const scheduled = () => ({
  idempotencyKey: randomUUID(),
  priority: 3,
  startAt: new Date(Date.now() + 600_000).toISOString(),
  type: 'schedule',
});

describe('job batches', () => {
  let api: INestApplication;
  let database: Database;
  let queue: QueueService;
  let baseUrl: string;
  let aircraftId: string;

  const reportItem = () => ({
    payload: {
      aircraftId,
      departureAt: new Date(Date.now() + 86_400_000).toISOString(),
      destinationIcao: 'KSFO',
      originIcao: 'RJTT',
    },
    type: 'aircraft-report',
  });

  const request = async (path: string, method: string, body?: unknown): Promise<Response> =>
    fetch(`${baseUrl}/api${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: { 'content-type': 'application/json' },
      method,
    });

  const createBatch = async (body: Record<string, unknown>): Promise<string> => {
    const response = await request('/job-batches', 'POST', body);
    expect(response.status).toBe(202);
    return createdSchema.parse(await response.json()).data.id;
  };

  const getBatch = async (id: string) => {
    const response = await request(`/job-batches/${id}`, 'GET');
    expect(response.status).toBe(200);
    return batchSchema.parse(await response.json()).data;
  };

  const childRows = async (batchId: string) =>
    database.select().from(jobs).where(eq(jobs.batchId, batchId)).orderBy(asc(jobs.batchPosition));

  const childAt = async (batchId: string, index: number) => {
    const row = (await childRows(batchId))[index];
    if (!row) throw new Error(`Batch ${batchId} has no child ${index}.`);
    return row;
  };

  /** Emulates a worker claim: pg-boss marks the row active and records the start time. */
  const claim = async (name: QueueName, id: string): Promise<void> => {
    await database.execute(
      sql`UPDATE pgboss.job SET state = 'active', started_on = now() WHERE name = ${name} AND id = ${id}::uuid`,
    );
  };

  const waitForBatch = async (id: string, status: string) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      const batch = await getBatch(id);
      if (batch.status === status) return batch;
      await sleep(250);
    }
    throw new Error(`Batch did not reach ${status} in 30 seconds.`);
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

  it('creates an ordered mixed batch that stays out of the top-level job list', async () => {
    const body = { ...scheduled(), items: [emailItem, webhookItem, reportItem()] };
    const id = await createBatch(body);

    const batch = await getBatch(id);
    expect(batch).toMatchObject({
      counts: { scheduled: 3 },
      progress: 0,
      status: 'scheduled',
      total: 3,
    });
    expect(batch.items.map((item) => [item.position, item.queue])).toEqual([
      [1, 'email'],
      [2, 'webhook'],
      [3, 'aircraft-report'],
    ]);
    const [first] = batch.items;
    const direct = await request(`/jobs/${first?.id}`, 'GET');
    expect(direct.status).toBe(200);
    const listed = await request('/jobs?pageSize=100', 'GET');
    expect(JSON.stringify(await listed.json())).not.toContain(first?.id);
    const batches = await request('/job-batches?pageSize=100', 'GET');
    expect(JSON.stringify(await batches.json())).toContain(id);

    for (const row of await childRows(id)) {
      const [queued] = await queue.boss.findJobs(row.queue, { id: row.id });
      expect(queued?.state).toBe('created');
      const events = await database.select().from(jobActivity).where(eq(jobActivity.jobId, row.id));
      expect(events.map((event) => event.event)).toEqual(['created']);
    }
  });

  it('reports a used batch key with the existing ID and an unknown batch as 404', async () => {
    const body = { ...scheduled(), items: [emailItem] };
    const id = await createBatch(body);
    const again = await request('/job-batches', 'POST', body);
    expect(again.status).toBe(409);
    expect(errorSchema.parse(await again.json()).error.details).toEqual({ existingBatchId: id });
    expect((await request(`/job-batches/${randomUUID()}`, 'GET')).status).toBe(404);
    expect((await request(`/job-batches/${randomUUID()}`, 'DELETE')).status).toBe(404);
  });

  it('rejects an invalid child by position and writes nothing', async () => {
    const before = await database.select().from(jobs).where(isNotNull(jobs.batchId));
    const key = randomUUID();
    const response = await request('/job-batches', 'POST', {
      ...scheduled(),
      idempotencyKey: key,
      items: [
        emailItem,
        { ...reportItem(), payload: { ...reportItem().payload, originIcao: 'ZZZZ' } },
      ],
    });
    expect(response.status).toBe(400);
    expect(errorSchema.parse(await response.json()).error.details).toMatchObject({ position: 2 });
    const after = await database.select().from(jobs).where(isNotNull(jobs.batchId));
    expect(after).toHaveLength(before.length);
    expect(
      await database.select().from(jobBatches).where(eq(jobBatches.idempotencyKey, key)),
    ).toEqual([]);
  });

  it('leaves no parent, child, event, or queue job when an enqueue fails', async () => {
    const key = randomUUID();
    const realSend = queue.boss.send.bind(queue.boss);
    // The first child is enqueued, the second enqueue fails.
    const sendMock = vi
      .spyOn(queue.boss, 'send')
      .mockImplementationOnce(realSend)
      .mockRejectedValueOnce(new Error('simulated enqueue failure'));
    const response = await request('/job-batches', 'POST', {
      ...scheduled(),
      idempotencyKey: key,
      items: [emailItem, webhookItem, emailItem],
    });
    const sendCalls = sendMock.mock.calls.length;
    sendMock.mockRestore();
    expect(response.status).toBe(500);
    expect(
      await database.select().from(jobBatches).where(eq(jobBatches.idempotencyKey, key)),
    ).toEqual([]);
    // The first child's queue insertion went through the same transaction, so it rolled back too.
    expect(sendCalls).toBe(2);
    const orphaned = await database.execute(
      sql`SELECT count(*)::int AS total FROM pgboss.job j WHERE j.name IN ('email', 'webhook') AND NOT EXISTS (SELECT 1 FROM jobs WHERE jobs.id = j.id)`,
    );
    expect(orphaned.rows[0]).toMatchObject({ total: 0 });
  });

  it('blocks direct cancel and manual retry of a child but keeps it readable', async () => {
    const id = await createBatch({ ...scheduled(), items: [emailItem] });
    const [child] = (await getBatch(id)).items;
    expect((await request(`/jobs/${child?.id}`, 'DELETE')).status).toBe(409);
    expect((await request(`/jobs/${child?.id}/retry`, 'POST')).status).toBe(409);
    expect((await request(`/jobs/${child?.id}`, 'GET')).status).toBe(200);
  });

  it('cancels every unclaimed child once and repeats without new events', async () => {
    const id = await createBatch({ ...scheduled(), items: [emailItem, webhookItem, reportItem()] });
    const cancelled = await request(`/job-batches/${id}`, 'DELETE');
    expect(cancelled.status).toBe(200);
    expect(batchSchema.parse(await cancelled.json()).data).toMatchObject({
      counts: { cancelled: 3 },
      progress: 100,
      status: 'cancelled',
    });
    const repeated = await request(`/job-batches/${id}`, 'DELETE');
    expect(repeated.status).toBe(200);
    expect(batchSchema.parse(await repeated.json()).data.status).toBe('cancelled');
    for (const row of await childRows(id)) {
      const events = await database
        .select()
        .from(jobActivity)
        .where(eq(jobActivity.jobId, row.id))
        .orderBy(asc(jobActivity.id));
      expect(events.map((event) => event.event)).toEqual(['created', 'cancelled']);
      const [queued] = await queue.boss.findJobs(row.queue, { id: row.id });
      expect(queued?.state).toBe('cancelled');
    }
  });

  it('keeps a claimed child active and denies it another attempt', async () => {
    const id = await createBatch({ ...scheduled(), items: [emailItem, webhookItem] });
    const first = await childAt(id, 0);
    const second = await childAt(id, 1);
    await claim(first.queue, first.id);

    const response = await request(`/job-batches/${id}`, 'DELETE');
    expect(response.status).toBe(200);
    expect(batchSchema.parse(await response.json()).data).toMatchObject({
      counts: { cancelled: 1, processing: 1 },
      status: 'cancelling',
    });
    const [active] = await queue.boss.findJobs(first.queue, { id: first.id });
    expect(active).toMatchObject({ retryLimit: active?.retryCount, state: 'active' });
    const [untouched] = await queue.boss.findJobs(second.queue, { id: second.id });
    expect(untouched?.state).toBe('cancelled');

    // A failure after the request is terminal for the job row and in pg-boss.
    const outcome = await api
      .get(FailJobAttemptUseCase, { strict: false })
      .execute(first.id, 1, 'delivery_failed', false);
    expect(outcome).toEqual({ terminal: true });
    await queue.boss.fail(first.queue, first.id);
    const [failed] = await queue.boss.findJobs(first.queue, { id: first.id });
    expect(failed?.state).toBe('failed');
    expect(await waitForBatch(id, 'cancelled')).toMatchObject({
      counts: { cancelled: 1, failed: 1 },
    });
  });

  it('cancels a child that failed into retry before the cancellation', async () => {
    const id = await createBatch({ ...scheduled(), items: [webhookItem] });
    const child = await childAt(id, 0);
    await claim(child.queue, child.id);
    await api
      .get(FailJobAttemptUseCase, { strict: false })
      .execute(child.id, 1, 'delivery_failed', false);
    await queue.boss.fail(child.queue, child.id);
    const [retrying] = await queue.boss.findJobs(child.queue, { id: child.id });
    expect(retrying?.state).toBe('retry');

    const response = await request(`/job-batches/${id}`, 'DELETE');
    expect(response.status).toBe(200);
    expect(batchSchema.parse(await response.json()).data).toMatchObject({
      counts: { cancelled: 1 },
      status: 'cancelled',
    });
    const [cancelled] = await queue.boss.findJobs(child.queue, { id: child.id });
    expect(cancelled?.state).toBe('cancelled');
  });

  it('cannot cancel a batch whose children all finished without a cancellation', async () => {
    const id = await createBatch({ ...scheduled(), items: [emailItem] });
    const child = await childAt(id, 0);
    await queue.boss.cancel(child.queue, child.id);
    await database.update(jobs).set({ status: 'completed' }).where(eq(jobs.id, child.id));
    const response = await request(`/job-batches/${id}`, 'DELETE');
    expect(response.status).toBe(409);
  });

  it('runs mixed children to completion and reports a child that fails after retries', async () => {
    const workerModule = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(EMAIL_CLIENT)
      .useValue(emailClient)
      .overrideProvider(WEBHOOK_CLIENT)
      .useValue(webhookClient)
      .overrideProvider(SIMULATION_DELAY)
      .useValue({ wait: () => Promise.resolve() })
      .compile();
    const worker = await workerModule.init();
    try {
      const okId = await createBatch({
        idempotencyKey: randomUUID(),
        items: [emailItem, webhookItem, reportItem()],
        maxAttempts: 1,
        priority: 3,
        type: 'instant',
      });
      const done = await waitForBatch(okId, 'completed');
      expect(done).toMatchObject({ counts: { completed: 3 }, progress: 100 });
      expect(done.items.every((item) => item.result !== null)).toBe(true);

      const failId = await createBatch({
        idempotencyKey: randomUUID(),
        items: [
          emailItem,
          { payload: { payload: 1, url: 'https://example.com/fail' }, type: 'webhook' },
        ],
        maxAttempts: 2,
        priority: 3,
        type: 'instant',
      });
      expect(await waitForBatch(failId, 'completed_with_errors')).toMatchObject({
        counts: { completed: 1, failed: 1 },
        progress: 100,
      });
    } finally {
      await worker.close();
    }
  }, 60_000);

  it('does not start a child of a scheduled batch before the shared start time', async () => {
    const id = await createBatch({
      ...scheduled(),
      items: [emailItem, webhookItem],
    });
    await sleep(500);
    const batch = await getBatch(id);
    expect(batch.counts).toMatchObject({ scheduled: 2 });
    expect(batch.status).toBe('scheduled');
  });
});
