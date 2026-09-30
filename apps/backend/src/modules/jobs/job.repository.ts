import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { jobActivity, jobBatches, jobs } from '@workspace/database/schema';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { fromDrizzle } from 'pg-boss';

import { QueueService } from '@/common/queue/queue.service.js';
import { retryPolicy } from '@/common/queue/retry-policy.js';

import type {
  ChildProgress,
  JobBatchChild,
  JobBatchRecord,
  ListJobBatchesInput,
} from './job-batch.js';
import type { CreateJobInput, Job, JobStatus, JobSummary, ListJobsInput } from './job.js';
import type { BatchInsert, JobRepository, JobTransition } from './ports/job.repository.js';
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

const attemptCount = sql<number>`(SELECT count(*)::int FROM ${jobActivity} WHERE ${jobActivity.jobId} = ${jobs.id} AND ${jobActivity.event} = 'started')`;

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const TERMINAL_STATUSES = new Set<JobStatus>(['completed', 'failed', 'cancelled']);

const batchColumns = {
  cancellationRequestedAt: jobBatches.cancellationRequestedAt,
  createdAt: jobBatches.createdAt,
  id: jobBatches.id,
  idempotencyKey: jobBatches.idempotencyKey,
  // Literal names: drizzle omits the table qualifier inside sql`` columns, which would make `id` ambiguous
  maxAttempts: sql<number>`(SELECT c.max_attempts FROM jobs c WHERE c.batch_id = job_batches.id ORDER BY c.batch_position LIMIT 1)`,
  priority: sql<number>`(SELECT c.priority FROM jobs c WHERE c.batch_id = job_batches.id ORDER BY c.batch_position LIMIT 1)`,
  startAt: jobBatches.startAt,
};

const summaryColumns = {
  attempts: attemptCount,
  batchId: jobs.batchId,
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
      const startAt = input.startAt ?? new Date();
      const id = await this.insertQueuedJob(tx, {
        idempotencyKey: input.idempotencyKey,
        maxAttempts: input.maxAttempts,
        payload: input.payload,
        priority: input.priority,
        queue,
        startAt,
        type: input.type,
      });
      return { duplicate: false, id, startAt };
    });
  }

  async findBatchSubmission(idempotencyKey: string): Promise<string | null> {
    const [existing] = await this.database
      .select({ id: jobBatches.id })
      .from(jobBatches)
      .where(eq(jobBatches.idempotencyKey, idempotencyKey));
    return existing?.id ?? null;
  }

  async createBatch(
    input: BatchInsert,
  ): Promise<{ id: string; startAt: Date; duplicate: boolean }> {
    return this.database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`job-batch:${input.idempotencyKey}`}))`,
      );
      const [existing] = await tx
        .select({ id: jobBatches.id, startAt: jobBatches.startAt })
        .from(jobBatches)
        .where(eq(jobBatches.idempotencyKey, input.idempotencyKey));
      if (existing) return { duplicate: true, id: existing.id, startAt: existing.startAt };
      const id = randomUUID();
      const startAt = input.startAt ?? new Date();
      await tx.insert(jobBatches).values({ id, idempotencyKey: input.idempotencyKey, startAt });
      // Submitted order is insertion order; any failure rolls back the parent, every child row and
      // event, and every queue insertion made through the transaction bridge.
      for (const [position, item] of input.items.entries()) {
        await this.insertQueuedJob(tx, {
          batch: { id, position },
          idempotencyKey: item.idempotencyKey,
          maxAttempts: input.maxAttempts,
          payload: item.payload,
          priority: input.priority,
          queue: item.queue,
          startAt,
          type: input.type,
        });
      }
      return { duplicate: false, id, startAt };
    });
  }

  private async insertQueuedJob(
    tx: Transaction,
    job: {
      batch?: { id: string; position: number };
      idempotencyKey: string;
      maxAttempts: number;
      payload: object;
      priority: number;
      queue: QueueName;
      startAt: Date;
      type: 'instant' | 'schedule';
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.insert(jobs).values({
      batchId: job.batch?.id ?? null,
      batchPosition: job.batch?.position ?? null,
      id,
      idempotencyKey: job.idempotencyKey,
      maxAttempts: job.maxAttempts,
      payload: { ...job.payload },
      priority: job.priority,
      queue: job.queue,
      startAt: job.startAt,
      status: job.type === 'schedule' ? 'scheduled' : 'pending',
      type: job.type,
    });
    await tx.insert(jobActivity).values({
      event: 'created',
      eventKey: 'created',
      jobId: id,
      recordedAt: sql`clock_timestamp()`,
    });
    const queuedId = await this.queue.boss.send(job.queue, job.payload, {
      ...retryPolicy(job.maxAttempts),
      db: fromDrizzle(tx, sql),
      id,
      priority: job.priority,
      startAfter: job.startAt,
    });
    if (queuedId !== id) throw new Error('Queue insertion did not return the assigned job ID.');
    return id;
  }

  async getJobBatch(
    id: string,
  ): Promise<{ batch: JobBatchRecord; children: JobBatchChild[] } | null> {
    return this.database.transaction(
      async (tx) => {
        const [batch] = await tx.select(batchColumns).from(jobBatches).where(eq(jobBatches.id, id));
        if (!batch) return null;
        const rows = await tx
          .select({ ...summaryColumns, position: sql<number>`${jobs.batchPosition} + 1` })
          .from(jobs)
          .leftJoin(queueJobs, and(eq(queueJobs.name, jobs.queue), eq(queueJobs.id, jobs.id)))
          .where(eq(jobs.batchId, id))
          .orderBy(asc(jobs.batchPosition));
        return {
          batch,
          children: rows.map(({ position, ...job }) => ({ job, position })),
        };
      },
      { accessMode: 'read only', isolationLevel: 'repeatable read' },
    );
  }

  async listJobBatches(
    input: ListJobBatchesInput,
  ): Promise<{ items: { batch: JobBatchRecord; children: ChildProgress[] }[]; total: number }> {
    return this.database.transaction(
      async (tx) => {
        const [counted] = await tx.select({ total: sql<number>`count(*)::int` }).from(jobBatches);
        const batches = await tx
          .select(batchColumns)
          .from(jobBatches)
          .orderBy(desc(jobBatches.createdAt), desc(jobBatches.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize);
        const childRows =
          batches.length === 0
            ? []
            : await tx
                .select({ attempts: attemptCount, batchId: jobs.batchId, status: effectiveStatus })
                .from(jobs)
                .leftJoin(queueJobs, and(eq(queueJobs.name, jobs.queue), eq(queueJobs.id, jobs.id)))
                .where(
                  inArray(
                    jobs.batchId,
                    batches.map((batch) => batch.id),
                  ),
                );
        return {
          items: batches.map((batch) => ({
            batch,
            children: childRows
              .filter((child) => child.batchId === batch.id)
              .map(({ attempts, status }) => ({ attempts, status })),
          })),
          total: counted?.total ?? 0,
        };
      },
      { accessMode: 'read only', isolationLevel: 'repeatable read' },
    );
  }

  async cancelJobBatch(
    id: string,
  ): Promise<'cancelled' | 'already_requested' | 'not_found' | 'not_cancellable'> {
    return this.database.transaction(async (tx) => {
      // Lock order: batch row, then child rows by position, then their queue rows by position. A
      // worker writing a transition locks only its child row first, so it never waits on us while
      // we wait on it.
      const [batch] = await tx.select().from(jobBatches).where(eq(jobBatches.id, id)).for('update');
      if (!batch) return 'not_found';
      if (batch.cancellationRequestedAt !== null) return 'already_requested';
      const children = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.batchId, id))
        .orderBy(asc(jobs.batchPosition))
        .for('update');
      for (const child of children) {
        await tx.execute(
          sql`SELECT id FROM pgboss.job WHERE name = ${child.queue} AND id = ${child.id}::uuid FOR UPDATE`,
        );
      }
      const db = fromDrizzle(tx, sql);
      let hasOpenChild = false;
      for (const child of children) {
        const [queued] = await this.queue.boss.findJobs(child.queue, { db, id: child.id });
        const stored = !TERMINAL_STATUSES.has(child.status);
        if (queued?.state === 'created' || queued?.state === 'retry') {
          hasOpenChild = true;
          await this.queue.boss.cancel(child.queue, child.id, { db });
          const [cancelled] = await this.queue.boss.findJobs(child.queue, { db, id: child.id });
          if (cancelled?.state !== 'cancelled') {
            throw new Error('Queue cancellation did not settle the child job.');
          }
          await tx
            .update(jobs)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(jobs.id, child.id));
          await tx
            .insert(jobActivity)
            .values({
              event: 'cancelled',
              eventKey: 'cancelled',
              jobId: child.id,
              recordedAt: sql`clock_timestamp()`,
            })
            .onConflictDoNothing();
        } else if (queued?.state === 'active') {
          hasOpenChild = true;
          // pg-boss retries a failed job only while retry_count < retry_limit. Lowering the limit
          // to the current count, under the row lock, makes this attempt the last one however it
          // fails (result, crash, expiry). The stored status is normalized to `processing` because
          // a failure recorded just before this lock would otherwise leave `scheduled` behind.
          await tx.execute(
            sql`UPDATE pgboss.job SET retry_limit = retry_count WHERE name = ${child.queue} AND id = ${child.id}::uuid AND state = 'active'`,
          );
          if (child.status === 'scheduled' || child.status === 'pending')
            await tx
              .update(jobs)
              .set({ status: 'processing', updatedAt: new Date() })
              .where(eq(jobs.id, child.id));
        } else if (stored) {
          hasOpenChild = true;
        }
      }
      if (!hasOpenChild) return 'not_cancellable';
      await tx
        .update(jobBatches)
        .set({ cancellationRequestedAt: new Date() })
        .where(eq(jobBatches.id, id));
      return 'cancelled';
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
    // Batch children appear inside their batch and by direct ID, not as top-level entries.
    const where = and(
      isNull(jobs.batchId),
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

  async writeJobTransition(id: string, transition: JobTransition): Promise<Job['status']> {
    return this.database.transaction(async (tx) => {
      let { status } = transition;
      const logs = [...transition.logs];
      const failure = transition.failedAttemptInCancelledBatch;
      if (failure) {
        // Holding the child row lock orders this write against a batch cancellation, which locks
        // the same row: either we see its committed request here, or it sees our written status.
        const [batched] = await tx
          .select({ cancellationRequestedAt: jobBatches.cancellationRequestedAt })
          .from(jobs)
          .innerJoin(jobBatches, eq(jobBatches.id, jobs.batchId))
          .where(eq(jobs.id, id))
          .for('update', { of: jobs });
        if (batched?.cancellationRequestedAt) {
          status = 'failed';
          logs.push({
            attempt: failure.attempt,
            errorCategory: failure.category,
            event: 'failed',
            eventKey: `failed:${failure.attempt}`,
          });
        }
      }
      const [updated] = await tx
        .update(jobs)
        .set({
          ...(transition.result === undefined ? {} : { result: transition.result }),
          status,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id))
        .returning({ queue: jobs.queue });
      if (transition.retryDelaySeconds !== undefined && updated) {
        // pg-boss `update` refuses active jobs, and the attempt is active when it starts, so the
        // column is written directly (like the row locks above). pg-boss reads it on failure.
        await tx.execute(
          sql`UPDATE pgboss.job SET retry_delay = ${transition.retryDelaySeconds} WHERE name = ${updated.queue} AND id = ${id}::uuid`,
        );
      }
      for (const log of logs) {
        await tx
          .insert(jobActivity)
          .values({
            ...log,
            jobId: id,
            recordedAt: sql`clock_timestamp()`,
          })
          .onConflictDoNothing();
      }
      return status;
    });
  }
}
