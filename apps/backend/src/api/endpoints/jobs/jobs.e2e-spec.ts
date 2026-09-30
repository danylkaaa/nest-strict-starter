import { createHash, randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { jobActivity, jobs, sentEmails } from '@workspace/database/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { err, ok } from 'neverthrow';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AppModule } from '@/api/api.module.js';
import { setupSwagger } from '@/api/core/swagger/swagger.config.js';
import { EMAIL_QUEUE, QueueService } from '@/common/queue/queue.service.js';
import { EmailDeliveryFailedError } from '@/modules/emails/email.errors.js';
import { EMAIL_CLIENT } from '@/modules/emails/ports/email-client.js';
import { SendEmailUseCase } from '@/modules/emails/use-case/send-email.use-case.js';
import { CompleteJobUseCase } from '@/modules/jobs/use-case/complete-job.use-case.js';
import { ReconcileJobsUseCase } from '@/modules/jobs/use-case/reconcile-jobs.use-case.js';
import { StartJobAttemptUseCase } from '@/modules/jobs/use-case/start-job-attempt.use-case.js';
import { WorkerModule } from '@/worker/worker.module.js';

import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import type { Database } from '@workspace/database/client';

const payload = {
  body: 'Integration body',
  recipient: 'integration@example.com',
  subject: 'Integration',
};
const createdSchema = z.object({ data: z.object({ id: z.uuid(), startAt: z.iso.datetime() }) });
const jobSchema = z.object({
  data: z.object({
    activity: z.array(z.object({ event: z.string() })),
    id: z.uuid(),
    result: z.object({ emailId: z.string() }).nullable(),
    status: z.string(),
  }),
});
const emailSchema = z.object({ data: z.object({ messageId: z.string(), recipient: z.string() }) });
const openApiSchema = z.object({
  paths: z.record(
    z.string(),
    z.record(z.string(), z.object({ responses: z.record(z.string(), z.unknown()) })),
  ),
});
function responsesFor(
  document: z.infer<typeof openApiSchema>,
  path: string,
  method: string,
): string[] {
  const operation = document.paths[path]?.[method];
  if (!operation) throw new Error(`Missing OpenAPI operation ${method} ${path}`);
  return Object.keys(operation.responses);
}
const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

async function waitForCompletion(baseUrl: string, id: string): Promise<z.infer<typeof jobSchema>> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${baseUrl}/api/jobs/${id}`);
    const job = jobSchema.parse(await response.json());
    if (job.data.status === 'completed') return job;
    await sleep(250);
  }
  throw new Error('Job did not complete in 10 seconds.');
}

async function waitForEvent(
  baseUrl: string,
  id: string,
  event: string,
): Promise<z.infer<typeof jobSchema>> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${baseUrl}/api/jobs/${id}`);
    const job = jobSchema.parse(await response.json());
    if (job.data.activity.some((item) => item.event === event)) return job;
    await sleep(250);
  }
  throw new Error(`Job did not record ${event} in 10 seconds.`);
}

async function waitForFailedCount(
  baseUrl: string,
  id: string,
  count: number,
): Promise<z.infer<typeof jobSchema>> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${baseUrl}/api/jobs/${id}`);
    const job = jobSchema.parse(await response.json());
    if (job.data.activity.filter((item) => item.event === 'attempt_failed').length >= count)
      return job;
    await sleep(250);
  }
  throw new Error(`Job did not record ${count} failed attempts in 10 seconds.`);
}

async function waitForQueueState(queue: QueueService, id: string, state: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const [job] = await queue.boss.findJobs(EMAIL_QUEUE, { id });
    if (job?.state === state) return;
    await sleep(250);
  }
  throw new Error(`Queue job did not reach ${state} in 10 seconds.`);
}

const reliableClient = {
  send: (_content: unknown, deliveryKey?: string) =>
    Promise.resolve(
      ok({
        messageId: `mock_${createHash('sha256')
          .update(deliveryKey ?? randomUUID())
          .digest('hex')}`,
      }),
    ),
};

describe('email jobs API and worker', () => {
  let api: INestApplication;
  let worker: INestApplicationContext;
  let database: Database;
  let queue: QueueService;
  let baseUrl: string;

  beforeAll(async () => {
    const apiModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_CLIENT)
      .useValue(reliableClient)
      .compile();
    api = apiModule.createNestApplication({ logger: false });
    api.setGlobalPrefix('api');
    setupSwagger(api);
    await api.listen(0, '127.0.0.1');
    baseUrl = await api.getUrl();
    database = api.get<Database>(getDrizzleToken());
    queue = api.get(QueueService);
  }, 30_000);

  afterAll(async () => {
    await worker?.close();
    await api?.close();
  });

  it('rejects every repeated submission key', async () => {
    const idempotencyKey = randomUUID();
    const body = { idempotencyKey, payload, priority: 5, type: 'instant' };
    const firstResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const first = createdSchema.parse(await firstResponse.json());
    expect(firstResponse.status).toBe(202);
    const againResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(againResponse.status).toBe(409);
    const changedResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({ ...body, priority: 4 }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(changedResponse.status).toBe(409);
    const [queued] = await queue.boss.findJobs(EMAIL_QUEUE, { id: first.data.id });
    expect(queued?.priority).toBe(5);
    expect(queued?.retryLimit).toBe(3);
    expect(queued?.retryDelay).toBe(60);
    expect(queued?.retryBackoff).toBe(true);
  });

  it('documents job error envelopes in OpenAPI', async () => {
    const response = await fetch(`${baseUrl}/api/docs-json`);
    expect(response.status).toBe(200);
    const document = openApiSchema.parse(await response.json());
    expect(responsesFor(document, '/api/jobs/email', 'post')).toContain('409');
    expect(responsesFor(document, '/api/jobs/{id}', 'get')).toContain('404');
    expect(responsesFor(document, '/api/jobs/{id}', 'delete')).toEqual(
      expect.arrayContaining(['404', '409']),
    );
  });

  it('accepts exactly one concurrent submission for a key', async () => {
    const body = { idempotencyKey: randomUUID(), payload, priority: 1, type: 'instant' };
    const post = () =>
      fetch(`${baseUrl}/api/jobs/email`, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    const responses = await Promise.all([post(), post()]);
    expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
      202, 409,
    ]);
  });

  it('claims eligible higher-priority jobs before lower-priority jobs', async () => {
    const name = `priority_${randomUUID().replaceAll('-', '')}`;
    await queue.boss.createQueue(name);
    const lower = await queue.boss.send(name, {}, { priority: 1 });
    const higher = await queue.boss.send(name, {}, { priority: 5 });
    const first = await queue.boss.fetch(name, { batchSize: 1 });
    expect(first.map((job) => job.id)).toEqual([higher]);
    const second = await queue.boss.fetch(name, { batchSize: 1 });
    expect(second.map((job) => job.id)).toEqual([lower]);
    await queue.boss.complete(name, [...first, ...second]);
  });

  it('schedules a future job, exposes activity, and cancels it once', async () => {
    const startAt = new Date(Date.now() + 120_000).toISOString();
    const createResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        payload,
        priority: 1,
        startAt,
        type: 'schedule',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const created = createdSchema.parse(await createResponse.json());
    expect(createResponse.status).toBe(202);
    expect(created.data.startAt).toBe(startAt);
    const id = created.data.id;
    const beforeResponse = await fetch(`${baseUrl}/api/jobs/${id}`);
    const before = jobSchema.parse(await beforeResponse.json());
    expect(before.data.status).toBe('scheduled');
    expect(before.data.activity.map((event) => event.event)).toEqual(['created']);
    const cancelled = await fetch(`${baseUrl}/api/jobs/${id}`, { method: 'DELETE' });
    expect(cancelled.status).toBe(200);
    const again = await fetch(`${baseUrl}/api/jobs/${id}`, { method: 'DELETE' });
    expect(again.status).toBe(409);
    const afterResponse = await fetch(`${baseUrl}/api/jobs/${id}`);
    const after = jobSchema.parse(await afterResponse.json());
    expect(after.data.status).toBe('cancelled');
    expect(after.data.activity.map((event) => event.event)).toEqual(['created', 'cancelled']);
  });

  it('does not cancel a job claimed while cancellation waits on its queue row', async () => {
    const startAt = new Date(Date.now() + 120_000).toISOString();
    const createdResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        payload,
        priority: 1,
        startAt,
        type: 'schedule',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const created = createdSchema.parse(await createdResponse.json());
    expect(createdResponse.status).toBe(202);
    const locked = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const transaction = database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM pgboss.job WHERE name = ${EMAIL_QUEUE} AND id = ${created.data.id}::uuid FOR UPDATE`,
      );
      locked.resolve();
      await release.promise;
      await tx.execute(
        sql`UPDATE pgboss.job SET state = 'active' WHERE name = ${EMAIL_QUEUE} AND id = ${created.data.id}::uuid`,
      );
    });
    await locked.promise;
    const cancelling = fetch(`${baseUrl}/api/jobs/${created.data.id}`, { method: 'DELETE' });
    await sleep(200);
    release.resolve();
    await transaction;
    const response = await cancelling;
    expect(response.status).toBe(409);
    const [queued] = await queue.boss.findJobs(EMAIL_QUEUE, { id: created.data.id });
    expect(queued?.state).toBe('active');
  }, 15_000);

  it('reports duplicate key before validating an elapsed schedule', async () => {
    const startAt = new Date(Date.now() + 1200).toISOString();
    const body = { idempotencyKey: randomUUID(), payload, priority: 1, startAt, type: 'schedule' };
    const firstResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    createdSchema.parse(await firstResponse.json());
    expect(firstResponse.status).toBe(202);
    await sleep(1300);
    const repeatedResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(repeatedResponse.status).toBe(409);
  });

  it('rejects past schedules and unknown job IDs', async () => {
    const invalidKey = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({ idempotencyKey: 'not-a-uuid', payload, priority: 1, type: 'instant' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(invalidKey.status).toBe(400);
    const invalid = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        payload,
        priority: 1,
        startAt: new Date(Date.now() - 1000).toISOString(),
        type: 'schedule',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(invalid.status).toBe(400);
    const missingGet = await fetch(`${baseUrl}/api/jobs/${randomUUID()}`);
    expect(missingGet.status).toBe(404);
    const missingDelete = await fetch(`${baseUrl}/api/jobs/${randomUUID()}`, { method: 'DELETE' });
    expect(missingDelete.status).toBe(404);
  });

  it('keeps the existing email endpoint synchronous', async () => {
    const beforeJobs = await database.select({ id: jobs.id }).from(jobs);
    const response = await fetch(`${baseUrl}/api/emails`, {
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const email = emailSchema.parse(await response.json());
    expect(response.status).toBe(201);
    expect(email.data.recipient).toBe(payload.recipient);
    expect(email.data.messageId).toMatch(/^mock_/u);
    const afterJobs = await database.select({ id: jobs.id }).from(jobs);
    expect(afterJobs).toHaveLength(beforeJobs.length);
  }, 10_000);

  it('returns the same sent record for a repeated delivery key', async () => {
    const sendEmail = api.get(SendEmailUseCase);
    const deliveryKey = `email-job:${randomUUID()}`;
    const first = await sendEmail.execute({ ...payload, deliveryKey });
    const second = await sendEmail.execute({ ...payload, deliveryKey });
    expect(first.isOk()).toBe(true);
    expect(second.isOk()).toBe(true);
    expect(first.map((email) => email.id).unwrapOr('')).toBe(
      second.map((email) => email.id).unwrapOr(''),
    );
    const records = await database
      .select()
      .from(sentEmails)
      .where(eq(sentEmails.deliveryKey, deliveryKey));
    expect(records).toHaveLength(1);
  }, 10_000);

  it('reconciles an interrupted attempt from pg-boss retry state', async () => {
    const createResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({ idempotencyKey: randomUUID(), payload, priority: 4, type: 'instant' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const created = createdSchema.parse(await createResponse.json());
    expect(createResponse.status).toBe(202);
    const claimedJobs = await queue.boss.fetch(EMAIL_QUEUE, {
      batchSize: 100,
      maxPriority: 4,
      minPriority: 4,
    });
    expect(claimedJobs.map((job) => job.id)).toContain(created.data.id);
    await api.get(StartJobAttemptUseCase).execute(created.data.id, 1);
    await queue.boss.fail(EMAIL_QUEUE, { id: created.data.id, retryCount: 0 });
    const response = await fetch(`${baseUrl}/api/jobs/${created.data.id}`);
    const reconciled = jobSchema.parse(await response.json());
    expect(reconciled.data.status).toBe('scheduled');
    expect(reconciled.data.activity.map((event) => event.event)).toEqual([
      'created',
      'started',
      'attempt_failed',
    ]);
  });

  it('records an interrupted first attempt before the second completes without a GET', async () => {
    const createResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({ idempotencyKey: randomUUID(), payload, priority: 4, type: 'instant' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const created = createdSchema.parse(await createResponse.json());
    expect(createResponse.status).toBe(202);
    const firstClaims = await queue.boss.fetch(EMAIL_QUEUE, {
      batchSize: 100,
      maxPriority: 4,
      minPriority: 4,
    });
    expect(firstClaims.map((job) => job.id)).toContain(created.data.id);
    await api.get(StartJobAttemptUseCase).execute(created.data.id, 1);
    await queue.boss.fail(EMAIL_QUEUE, { id: created.data.id, retryCount: 0 });
    await queue.boss.update(EMAIL_QUEUE, undefined, {
      id: created.data.id,
      startAfter: new Date(),
    });
    const secondClaims = await queue.boss.fetch(EMAIL_QUEUE, {
      batchSize: 100,
      maxPriority: 4,
      minPriority: 4,
    });
    const retried = secondClaims.find((job) => job.id === created.data.id);
    expect(retried?.retryCount).toBe(1);
    await api.get(StartJobAttemptUseCase).execute(created.data.id, 2);
    const delivery = await api
      .get(SendEmailUseCase)
      .execute({ ...payload, deliveryKey: `email-job:${created.data.id}` });
    expect(delivery.isOk()).toBe(true);
    const emailId = delivery.map((email) => email.id).unwrapOr('');
    await api.get(CompleteJobUseCase).execute(created.data.id, 2, { emailId });
    await queue.boss.complete(EMAIL_QUEUE, { id: created.data.id, retryCount: 1 });
    const events = await database
      .select({ attempt: jobActivity.attempt, event: jobActivity.event })
      .from(jobActivity)
      .where(eq(jobActivity.jobId, created.data.id))
      .orderBy(asc(jobActivity.recordedAt), asc(jobActivity.id));
    expect(events).toEqual([
      { attempt: null, event: 'created' },
      { attempt: 1, event: 'started' },
      { attempt: 1, event: 'attempt_failed' },
      { attempt: 2, event: 'started' },
      { attempt: 2, event: 'completed' },
    ]);
  }, 20_000);

  it('recovers terminal failure without an API status read', async () => {
    const createResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({ idempotencyKey: randomUUID(), payload, priority: 1, type: 'instant' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const created = createdSchema.parse(await createResponse.json());
    expect(createResponse.status).toBe(202);
    await queue.boss.update(EMAIL_QUEUE, undefined, { id: created.data.id, retryLimit: 0 });
    const claims = await queue.boss.fetch(EMAIL_QUEUE, {
      batchSize: 100,
      maxPriority: 1,
      minPriority: 1,
    });
    expect(claims.map((job) => job.id)).toContain(created.data.id);
    await api.get(StartJobAttemptUseCase).execute(created.data.id, 1);
    await queue.boss.fail(EMAIL_QUEUE, { id: created.data.id, retryCount: 0 });
    await api.get(ReconcileJobsUseCase).execute();
    const events = await database
      .select({ attempt: jobActivity.attempt, event: jobActivity.event })
      .from(jobActivity)
      .where(eq(jobActivity.jobId, created.data.id))
      .orderBy(asc(jobActivity.recordedAt), asc(jobActivity.id));
    expect(events).toEqual([
      { attempt: null, event: 'created' },
      { attempt: 1, event: 'started' },
      { attempt: 1, event: 'attempt_failed' },
      { attempt: 1, event: 'failed' },
    ]);
    const [row] = await database
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, created.data.id));
    expect(row?.status).toBe('failed');
  });

  it('records a failed attempt and schedules the retry after 60 seconds', async () => {
    const failing = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(EMAIL_CLIENT)
      .useValue({ send: () => Promise.resolve(err(new EmailDeliveryFailedError())) })
      .compile();
    await failing.init();
    try {
      const createResponse = await fetch(`${baseUrl}/api/jobs/email`, {
        body: JSON.stringify({
          idempotencyKey: randomUUID(),
          payload,
          priority: 2,
          type: 'instant',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const created = createdSchema.parse(await createResponse.json());
      expect(createResponse.status).toBe(202);
      const failed = await waitForEvent(baseUrl, created.data.id, 'attempt_failed');
      expect(failed.data.activity.map((event) => event.event)).toEqual([
        'created',
        'started',
        'attempt_failed',
      ]);
      const [queued] = await queue.boss.findJobs(EMAIL_QUEUE, { id: created.data.id });
      expect(queued?.state).toBe('retry');
      expect(queued?.startAfter.getTime()).toBeGreaterThan(Date.now() + 40_000);
      for (const [index, state] of ['retry', 'retry', 'failed'].entries()) {
        const attempt = index + 2;
        const expedited = await queue.boss.update(EMAIL_QUEUE, undefined, {
          id: created.data.id,
          startAfter: new Date(),
        });
        expect(expedited.updated).toBe(1);
        await waitForFailedCount(baseUrl, created.data.id, attempt);
        await waitForQueueState(queue, created.data.id, state);
      }
      const finalResponse = await fetch(`${baseUrl}/api/jobs/${created.data.id}`);
      const final = jobSchema.parse(await finalResponse.json());
      expect(final.data.status).toBe('failed');
      expect(final.data.activity.filter((event) => event.event === 'started')).toHaveLength(4);
      expect(final.data.activity.filter((event) => event.event === 'attempt_failed')).toHaveLength(
        4,
      );
      expect(final.data.activity.filter((event) => event.event === 'failed')).toHaveLength(1);
    } finally {
      await failing.close();
    }
  }, 30_000);

  it('fails malformed queue payload without retry', async () => {
    const createResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({ idempotencyKey: randomUUID(), payload, priority: 2, type: 'instant' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const created = createdSchema.parse(await createResponse.json());
    expect(createResponse.status).toBe(202);
    const updated = await queue.boss.update(
      EMAIL_QUEUE,
      { recipient: 'bad' },
      { id: created.data.id },
    );
    expect(updated.updated).toBe(1);
    const context = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    try {
      const failed = await waitForEvent(baseUrl, created.data.id, 'failed');
      expect(failed.data.activity.map((event) => event.event)).toEqual([
        'created',
        'started',
        'attempt_failed',
        'failed',
      ]);
      const [queued] = await queue.boss.findJobs(EMAIL_QUEUE, { id: created.data.id });
      expect(queued?.state).toBe('failed');
    } finally {
      await context.close();
    }
  }, 20_000);

  it('delivers a queued job in the separate worker', async () => {
    const log = vi.spyOn(PinoLogger.prototype, 'info');
    const workerModule = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(EMAIL_CLIENT)
      .useValue(reliableClient)
      .compile();
    worker = await workerModule.init();
    const createResponse = await fetch(`${baseUrl}/api/jobs/email`, {
      body: JSON.stringify({ idempotencyKey: randomUUID(), payload, priority: 3, type: 'instant' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const created = createdSchema.parse(await createResponse.json());
    expect(createResponse.status).toBe(202);
    const completed = await waitForCompletion(baseUrl, created.data.id);
    expect(completed.data.activity.map((event) => event.event)).toEqual([
      'created',
      'started',
      'completed',
    ]);
    const records = await database
      .select()
      .from(sentEmails)
      .where(eq(sentEmails.deliveryKey, `email-job:${created.data.id}`));
    expect(records).toHaveLength(1);
    expect(completed.data.result).toEqual({ emailId: records[0]?.id });
    const entries: unknown[] = log.mock.calls.map((call: unknown[]) => call[0]);
    expect(entries).toContainEqual({
      attempt: 1,
      jobId: created.data.id,
      outcome: 'pickup',
      queue: EMAIL_QUEUE,
    });
    expect(entries).toContainEqual({
      attempt: 1,
      jobId: created.data.id,
      outcome: 'completed',
      queue: EMAIL_QUEUE,
    });
    expect(JSON.stringify(entries)).not.toContain(payload.recipient);
    expect(JSON.stringify(entries)).not.toContain(payload.subject);
    expect(JSON.stringify(entries)).not.toContain(payload.body);
    log.mockRestore();
  }, 20_000);
});
