import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { jobActivity, jobs } from '@workspace/database/schema';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { fromDrizzle } from 'pg-boss';

import { QueueService } from '@/common/queue/queue.service.js';
import { retryPolicy } from '@/common/queue/retry-policy.js';

import type { CreateJobInput, Job, JobStatus, JobSummary, ListJobsInput } from './job.js';
import type { JobRepository, JobTransition } from './ports/job.repository.js';
import type { QueueName } from '@/common/queue/queue.service.js';
import type { Database } from '@workspace/database/client';

/** Read-only view of the pg-boss job table, used to learn when a retry becomes eligible. */
const queueJobs = pgSchema('pgboss').table('job', {
  id: uuid('id').notNull(),
  name: text('name').notNull(),
  startAfter: timestamp('start_after', { withTimezone: true }).notNull(),
});

/**
 * The status the UI shows and filters on. The stored status is only written on transitions, so a
 * `scheduled` job whose eligibility time has passed is `pending`. The queue's `start_after` is
 * preferred because a retry delay moves it past the job's original `start_at`.
 */
const effectiveStatus = sql<JobStatus>`CASE WHEN ${jobs.status} = 'scheduled' AND COALESCE(${queueJobs.startAfter}, ${jobs.startAt}) <= now() THEN 'pending' ELSE ${jobs.status} END`;

const summaryColumns = {
  attempts: sql<number>`(SELECT count(*)::int FROM ${jobActivity} WHERE ${jobActivity.jobId} = ${jobs.id} AND ${jobActivity.event} = 'started')`,
  completedAt:
    sql`CASE WHEN ${jobs.status} IN ('completed', 'failed', 'cancelled') THEN (SELECT max(${jobActivity.recordedAt}) FROM ${jobActivity} WHERE ${jobActivity.jobId} = ${jobs.id} AND ${jobActivity.event} IN ('completed', 'failed', 'cancelled')) END`.mapWith(
      jobActivity.recordedAt,
    ),
  createdAt: jobs.createdAt,
  id: jobs.id,
  idempotencyKey: jobs.idempotencyKey,
  lastErrorCategory: sql<
    string | null
  >`(SELECT ${jobActivity.errorCategory} FROM ${jobActivity} WHERE ${jobActivity.jobId} = ${jobs.id} AND ${jobActivity.event} = 'attempt_failed' ORDER BY ${jobActivity.recordedAt} DESC, ${jobActivity.id} DESC LIMIT 1)`,
  maxAttempts: jobs.maxAttempts,
  payload: jobs.payload,
  priority: jobs.priority,
  queue: jobs.queue,
  result: jobs.result,
  startAt: jobs.startAt,
  status: effectiveStatus,
};

const escapeLike = (value: string): string => value.replaceAll(/[\\%_]/gu, String.raw`\$&`);

@Injectable()
export class DrizzleJobRepository implements JobRepository {
  constructor(
    @Inject(getDrizzleToken()) private readonly database: Database,
    private readonly queue: QueueService,
  ) {}

  async findSubmission(idempotencyKey: string): Promise<string | null> {
    const [existing] = await this.database
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.idempotencyKey, idempotencyKey));
    return existing?.id ?? null;
  }

  async create(
    queue: QueueName,
    input: CreateJobInput,
  ): Promise<{ id: string; startAt: Date; duplicate: boolean }> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`);
      const [existing] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.idempotencyKey, input.idempotencyKey));
      if (existing)
        return {
          duplicate: true,
          id: existing.id,
          startAt: existing.startAt,
        };
      const id = randomUUID();
      const startAt = input.startAt ?? new Date();
      await tx.insert(jobs).values({
        id,
        idempotencyKey: input.idempotencyKey,
        maxAttempts: input.maxAttempts,
        payload: { ...input.payload },
        priority: input.priority,
        queue,
        startAt,
        status: input.type === 'schedule' ? 'scheduled' : 'pending',
        type: input.type,
      });
      await tx.insert(jobActivity).values({
        event: 'created',
        eventKey: 'created',
        jobId: id,
        recordedAt: sql`clock_timestamp()`,
      });
      const queuedId = await this.queue.boss.send(queue, input.payload, {
        ...retryPolicy(input.maxAttempts),
        db: fromDrizzle(tx, sql),
        id,
        priority: input.priority,
        startAfter: startAt,
      });
      if (queuedId !== id) throw new Error('Queue insertion did not return the assigned job ID.');
      return { duplicate: false, id, startAt };
    });
  }

  async getJob(id: string): Promise<JobSummary | null> {
    const [row] = await this.database
      .select(summaryColumns)
      .from(jobs)
      .leftJoin(queueJobs, and(eq(queueJobs.name, jobs.queue), eq(queueJobs.id, jobs.id)))
      .where(eq(jobs.id, id));
    return row ?? null;
  }

  async listJobs(input: ListJobsInput): Promise<{ items: JobSummary[]; total: number }> {
    const pattern = input.search === undefined ? undefined : `%${escapeLike(input.search)}%`;
    const where = and(
      input.queue === undefined ? undefined : eq(jobs.queue, input.queue),
      input.statuses === undefined ? undefined : inArray(effectiveStatus, input.statuses),
      pattern === undefined
        ? undefined
        : or(ilike(sql`${jobs.id}::text`, pattern), ilike(sql`${jobs.payload}::text`, pattern)),
    );
    const joinOn = and(eq(queueJobs.name, jobs.queue), eq(queueJobs.id, jobs.id));
    const [items, [counted]] = await Promise.all([
      this.database
        .select(summaryColumns)
        .from(jobs)
        .leftJoin(queueJobs, joinOn)
        .where(where)
        .orderBy(desc(jobs.createdAt), desc(jobs.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.database
        .select({ total: sql<number>`count(*)::int` })
        .from(jobs)
        .leftJoin(queueJobs, joinOn)
        .where(where),
    ]);
    return { items, total: counted?.total ?? 0 };
  }

  async countJobsByStatus(): Promise<Record<JobStatus, number>> {
    const rows = await this.database
      .select({ count: sql<number>`count(*)::int`, status: effectiveStatus })
      .from(jobs)
      .leftJoin(queueJobs, and(eq(queueJobs.name, jobs.queue), eq(queueJobs.id, jobs.id)))
      .groupBy(effectiveStatus);
    const counts: Record<JobStatus, number> = {
      cancelled: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      scheduled: 0,
    };
    for (const row of rows) counts[row.status] = row.count;
    return counts;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.database.execute(sql`SELECT 1`);
      await this.queue.boss.getQueues();
      return true;
    } catch {
      return false;
    }
  }

  async getJobActivity(id: string): Promise<Job['activity']> {
    return this.database
      .select({
        attempt: jobActivity.attempt,
        errorCategory: jobActivity.errorCategory,
        event: jobActivity.event,
        id: jobActivity.id,
        recordedAt: jobActivity.recordedAt,
      })
      .from(jobActivity)
      .where(eq(jobActivity.jobId, id))
      .orderBy(asc(jobActivity.recordedAt), asc(jobActivity.id));
  }

  async getQueueJob(
    queue: QueueName,
    id: string,
  ): Promise<{ state: string; startAfter: Date; retryCount: number } | null> {
    const [queued] = await this.queue.boss.findJobs(queue, { id });
    return queued ?? null;
  }

  async setJobStatus(id: string, status: Job['status']): Promise<void> {
    await this.database.update(jobs).set({ status, updatedAt: new Date() }).where(eq(jobs.id, id));
  }

  async addJobLog(
    id: string,
    event: Job['activity'][number]['event'],
    eventKey: string,
    attempt?: number,
    errorCategory?: string,
  ): Promise<void> {
    await this.database
      .insert(jobActivity)
      .values({
        attempt,
        errorCategory,
        event,
        eventKey,
        jobId: id,
        recordedAt: sql`clock_timestamp()`,
      })
      .onConflictDoNothing();
  }

  async listProcessingJobs(): Promise<{ id: string; queue: QueueName }[]> {
    return this.database
      .select({ id: jobs.id, queue: jobs.queue })
      .from(jobs)
      .where(eq(jobs.status, 'processing'));
  }

  async cancelJob(
    queue: QueueName,
    id: string,
  ): Promise<'cancelled' | 'not_found' | 'not_cancellable'> {
    return this.database.transaction(async (tx) => {
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, id)).for('update');
      if (!row) return 'not_found';
      if (row.status !== 'scheduled' && row.status !== 'pending') return 'not_cancellable';
      await tx.execute(
        sql`SELECT id FROM pgboss.job WHERE name = ${queue} AND id = ${id}::uuid FOR UPDATE`,
      );
      const [queueJob] = await this.queue.boss.findJobs(queue, {
        db: fromDrizzle(tx, sql),
        id,
      });
      if (!queueJob || (queueJob.state !== 'created' && queueJob.state !== 'retry'))
        return 'not_cancellable';
      await this.queue.boss.cancel(queue, id, { db: fromDrizzle(tx, sql) });
      const [cancelled] = await this.queue.boss.findJobs(queue, {
        db: fromDrizzle(tx, sql),
        id,
      });
      if (cancelled?.state !== 'cancelled') return 'not_cancellable';
      await tx
        .update(jobs)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(jobs.id, id));
      await tx
        .insert(jobActivity)
        .values({
          event: 'cancelled',
          eventKey: 'cancelled',
          jobId: id,
          recordedAt: sql`clock_timestamp()`,
        })
        .onConflictDoNothing();
      return 'cancelled';
    });
  }

  async retryJob(queue: QueueName, id: string): Promise<'retried' | 'not_found' | 'not_retryable'> {
    return this.database.transaction(async (tx) => {
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, id)).for('update');
      if (!row) return 'not_found';
      if (row.status !== 'failed') return 'not_retryable';
      await tx.execute(
        sql`SELECT id FROM pgboss.job WHERE name = ${queue} AND id = ${id}::uuid FOR UPDATE`,
      );
      const db = fromDrizzle(tx, sql);
      const [queueJob] = await this.queue.boss.findJobs(queue, { db, id });
      if (queueJob?.state !== 'failed') return 'not_retryable';
      // pg-boss turns a failed job back into `retry` and raises its retry limit by one, keeping the
      // retry count, so the next claim is attempt retryCount + 2 and the limit matches max_attempts.
      await this.queue.boss.retry(queue, id, { db });
      await this.queue.boss.update(queue, undefined, { db, id, startAfter: new Date() });
      const [retried] = await this.queue.boss.findJobs(queue, { db, id });
      if (retried?.state !== 'retry') return 'not_retryable';
      const attempt = retried.retryCount + 2;
      await tx
        .update(jobs)
        .set({
          maxAttempts: sql`${jobs.maxAttempts} + 1`,
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
      await tx
        .insert(jobActivity)
        .values({
          attempt,
          event: 'retried',
          eventKey: `retried:${attempt}`,
          jobId: id,
          recordedAt: sql`clock_timestamp()`,
        })
        .onConflictDoNothing();
      return 'retried';
    });
  }

  async writeJobTransition(id: string, transition: JobTransition): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({
          ...(transition.result === undefined ? {} : { result: transition.result }),
          status: transition.status,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
      for (const log of transition.logs) {
        await tx
          .insert(jobActivity)
          .values({
            ...log,
            jobId: id,
            recordedAt: sql`clock_timestamp()`,
          })
          .onConflictDoNothing();
      }
    });
  }
}
