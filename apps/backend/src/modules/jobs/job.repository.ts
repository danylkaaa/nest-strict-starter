import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { jobActivity, jobBatches, jobs } from '@workspace/database/schema';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { fromDrizzle } from 'pg-boss';

import { QueueService } from '@/common/queue/queue.service.js';
import { HEARTBEAT_SECONDS, retryPolicy } from '@/common/queue/retry-policy.js';

import type {
  ChildProgress,
  JobBatchActivityRow,
  JobBatchChild,
  JobBatchRecord,
  ListJobBatchesInput,
} from './job-batch.js';
import type { CreateJobInput, Job, JobStatus, JobSummary, ListJobsInput } from './job.js';
import type { BatchInsert, JobRepository, JobTransition } from './ports/job.repository.js';
import type { QueueName } from '@/common/queue/queue.service.js';
import type { Database } from '@workspace/database/client';

const attemptCount = sql<number>`(SELECT count(*)::int FROM ${jobActivity} WHERE ${jobActivity.jobId} = jobs.id AND ${jobActivity.event} = 'started')`;

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
    sql`CASE WHEN ${jobs.status} IN ('completed', 'failed', 'cancelled') THEN (SELECT max(${jobActivity.recordedAt}) FROM ${jobActivity} WHERE ${jobActivity.jobId} = jobs.id AND ${jobActivity.event} IN ('completed', 'failed', 'cancelled')) END`.mapWith(
      jobActivity.recordedAt,
    ),
  createdAt: jobs.createdAt,
  id: jobs.id,
  idempotencyKey: jobs.idempotencyKey,
  lastErrorCategory: sql<
    string | null
  >`(SELECT ${jobActivity.errorCategory} FROM ${jobActivity} WHERE ${jobActivity.jobId} = jobs.id AND ${jobActivity.event} = 'attempt_failed' ORDER BY ${jobActivity.recordedAt} DESC, ${jobActivity.id} DESC LIMIT 1)`,
  maxAttempts: jobs.maxAttempts,
  payload: jobs.payload,
  priority: jobs.priority,
  queue: jobs.queue,
  result: jobs.result,
  startAt: jobs.startAt,
  status: jobs.status,
};

const escapeLike = (value: string): string => value.replaceAll(/[\\%_]/gu, String.raw`\$&`);

@Injectable()
export class DrizzleJobRepository implements JobRepository {
  constructor(
    @Inject(getDrizzleToken()) private readonly database: Database,
    private readonly queue: QueueService,
  ) {}

  private async effectiveJobStatus(
    row: Pick<JobSummary, 'id' | 'queue' | 'startAt' | 'status'>,
    db?: ReturnType<typeof fromDrizzle>,
    asOf = Date.now(),
  ): Promise<JobStatus> {
    if (row.status !== 'scheduled') return row.status;
    const [queued] = await this.queue.boss.findJobs(row.queue, { db, id: row.id });
    const eligibleAt = queued?.startAfter ?? row.startAt;
    const eligibleTime =
      eligibleAt instanceof Date ? eligibleAt.getTime() : Date.parse(String(eligibleAt));
    return eligibleTime <= asOf ? 'pending' : 'scheduled';
  }

  private async effectiveSummary(
    row: JobSummary,
    db?: ReturnType<typeof fromDrizzle>,
    asOf = Date.now(),
  ): Promise<JobSummary> {
    return { ...row, status: await this.effectiveJobStatus(row, db, asOf) };
  }

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
      heartbeatSeconds: HEARTBEAT_SECONDS,
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
          .where(eq(jobs.batchId, id))
          .orderBy(asc(jobs.batchPosition));
        const asOf = Date.now();
        const db = fromDrizzle(tx, sql);
        const children: JobBatchChild[] = [];
        for (const { position, ...job } of rows)
          children.push({ job: await this.effectiveSummary(job, db, asOf), position });
        return {
          batch,
          children,
        };
      },
      { accessMode: 'read only', isolationLevel: 'repeatable read' },
    );
  }

  async getJobBatchActivity(
    id: string,
  ): Promise<{ batch: JobBatchRecord; rows: JobBatchActivityRow[] } | null> {
    return this.database.transaction(
      async (tx) => {
        const [batch] = await tx.select(batchColumns).from(jobBatches).where(eq(jobBatches.id, id));
        if (!batch) return null;
        const rows = await tx
          .select({
            attempt: jobActivity.attempt,
            errorCategory: jobActivity.errorCategory,
            event: jobActivity.event,
            id: jobActivity.id,
            jobId: jobActivity.jobId,
            position: sql<number>`${jobs.batchPosition} + 1`,
            queue: jobs.queue,
            recordedAt: jobActivity.recordedAt,
          })
          .from(jobActivity)
          .innerJoin(jobs, eq(jobs.id, jobActivity.jobId))
          .where(eq(jobs.batchId, id))
          .orderBy(asc(jobActivity.recordedAt), asc(jobActivity.id));
        return { batch, rows };
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
                .select({
                  attempts: attemptCount,
                  batchId: jobs.batchId,
                  id: jobs.id,
                  queue: jobs.queue,
                  startAt: jobs.startAt,
                  status: jobs.status,
                })
                .from(jobs)
                .where(
                  inArray(
                    jobs.batchId,
                    batches.map((batch) => batch.id),
                  ),
                );
        const asOf = Date.now();
        const db = fromDrizzle(tx, sql);
        const children: (ChildProgress & { batchId: string | null })[] = [];
        for (const row of childRows)
          children.push({
            attempts: row.attempts,
            batchId: row.batchId,
            status: await this.effectiveJobStatus(row, db, asOf),
          });
        return {
          items: batches.map((batch) => ({
            batch,
            children: children
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
      // Lock order: batch row, then child rows by position. The SDK's guarded update locks an
      // unclaimed queue row through this transaction before cancellation checks its state.
      const [batch] = await tx.select().from(jobBatches).where(eq(jobBatches.id, id)).for('update');
      if (!batch) return 'not_found';
      if (batch.cancellationRequestedAt !== null) return 'already_requested';
      const children = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.batchId, id))
        .orderBy(asc(jobs.batchPosition))
        .for('update');
      const db = fromDrizzle(tx, sql);
      let hasOpenChild = false;
      for (const child of children) {
        const locked = await this.queue.boss.update(child.queue, undefined, { db, id: child.id });
        const [queued] = await this.queue.boss.findJobs(child.queue, { db, id: child.id });
        const stored = !TERMINAL_STATUSES.has(child.status);
        if (locked.updated === 1 && (queued?.state === 'created' || queued?.state === 'retry')) {
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
          // The active attempt continues. If pg-boss retries it after a crash, the next claim
          // observes cancellation_requested_at and dead-letters before any business side effect.
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
    const [row] = await this.database.select(summaryColumns).from(jobs).where(eq(jobs.id, id));
    return row ? this.effectiveSummary(row) : null;
  }

  async listJobs(input: ListJobsInput): Promise<{ items: JobSummary[]; total: number }> {
    const pattern = input.search === undefined ? undefined : `%${escapeLike(input.search)}%`;
    const needsEligibility =
      input.statuses?.includes('pending') === true ||
      input.statuses?.includes('scheduled') === true;
    const candidateStatuses =
      input.statuses === undefined
        ? undefined
        : needsEligibility
          ? [...new Set<JobStatus>([...input.statuses, 'scheduled'])]
          : input.statuses;
    // Batch children appear inside their batch and by direct ID, not as top-level entries.
    const where = and(
      isNull(jobs.batchId),
      input.queue === undefined ? undefined : eq(jobs.queue, input.queue),
      candidateStatuses === undefined ? undefined : inArray(jobs.status, candidateStatuses),
      pattern === undefined
        ? undefined
        : or(ilike(sql`${jobs.id}::text`, pattern), ilike(sql`${jobs.payload}::text`, pattern)),
    );
    if (needsEligibility) {
      // Eligibility changes with time without a database write. Check every candidate before
      // pagination so totals and page boundaries use the same effective status as item details.
      const candidates = await this.database
        .select(summaryColumns)
        .from(jobs)
        .where(where)
        .orderBy(desc(jobs.createdAt), desc(jobs.id));
      const matching: JobSummary[] = [];
      for (const candidate of candidates) {
        const item = await this.effectiveSummary(candidate);
        if (input.statuses?.includes(item.status)) matching.push(item);
      }
      return {
        items: matching.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
        total: matching.length,
      };
    }
    const [items, [counted]] = await Promise.all([
      this.database
        .select(summaryColumns)
        .from(jobs)
        .where(where)
        .orderBy(desc(jobs.createdAt), desc(jobs.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.database
        .select({ total: sql<number>`count(*)::int` })
        .from(jobs)
        .where(where),
    ]);
    const effectiveItems: JobSummary[] = [];
    for (const item of items) effectiveItems.push(await this.effectiveSummary(item));
    return { items: effectiveItems, total: counted?.total ?? 0 };
  }

  async countJobsByStatus(): Promise<Record<JobStatus, number>> {
    return this.database.transaction(
      async (tx) => {
        const asOf = Date.now();
        const rows = await tx
          .select({ count: sql<number>`count(*)::int`, status: jobs.status })
          .from(jobs)
          .groupBy(jobs.status);
        const counts: Record<JobStatus, number> = {
          cancelled: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          processing: 0,
          scheduled: 0,
        };
        for (const row of rows) counts[row.status] = row.count;
        const scheduled = await tx
          .select({ id: jobs.id, queue: jobs.queue, startAt: jobs.startAt, status: jobs.status })
          .from(jobs)
          .where(eq(jobs.status, 'scheduled'));
        const db = fromDrizzle(tx, sql);
        for (const row of scheduled) {
          if ((await this.effectiveJobStatus(row, db, asOf)) === 'pending') {
            counts.scheduled -= 1;
            counts.pending += 1;
          }
        }
        return counts;
      },
      { accessMode: 'read only', isolationLevel: 'repeatable read' },
    );
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
      const db = fromDrizzle(tx, sql);
      const locked = await this.queue.boss.update(queue, undefined, { db, id });
      if (locked.updated !== 1) return 'not_cancellable';
      const [queueJob] = await this.queue.boss.findJobs(queue, {
        db,
        id,
      });
      if (!queueJob || (queueJob.state !== 'created' && queueJob.state !== 'retry'))
        return 'not_cancellable';
      await this.queue.boss.cancel(queue, id, { db });
      const [cancelled] = await this.queue.boss.findJobs(queue, {
        db,
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
      const skipped = transition.skipIfBatchCancelled;
      if (failure || skipped) {
        // Take the child lock in a separate statement. Under READ COMMITTED, a joined read that
        // begins while cancellation holds this lock can see the old batch timestamp even after
        // it unblocks; the following statement gets a fresh snapshot after cancellation commits.
        const [locked] = await tx
          .select({ batchId: jobs.batchId })
          .from(jobs)
          .where(eq(jobs.id, id))
          .for('update');
        const [batch] = locked?.batchId
          ? await tx
              .select({ cancellationRequestedAt: jobBatches.cancellationRequestedAt })
              .from(jobBatches)
              .where(eq(jobBatches.id, locked.batchId))
          : [];
        if (batch?.cancellationRequestedAt) {
          status = 'failed';
          if (skipped)
            logs.push({
              attempt: skipped.attempt,
              errorCategory: 'batch_cancelled',
              event: 'attempt_failed',
              eventKey: `attempt_failed:${skipped.attempt}`,
            });
          logs.push({
            attempt: failure?.attempt ?? skipped?.attempt,
            errorCategory: failure?.category ?? 'batch_cancelled',
            event: 'failed',
            eventKey: `failed:${failure?.attempt ?? skipped?.attempt}`,
          });
        }
      }
      await tx
        .update(jobs)
        .set({
          ...(transition.result === undefined ? {} : { result: transition.result }),
          status,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
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
