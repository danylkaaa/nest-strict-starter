import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { jobActivity, jobs } from '@workspace/database/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { fromDrizzle } from 'pg-boss';

import { EMAIL_QUEUE, QueueService } from '@/common/queue/queue.service.js';

import type { CreateEmailJobInput, EmailJob } from './job.js';
import type { JobRepository } from './ports/job.repository.js';
import type { Database } from '@workspace/database/client';

@Injectable()
export class DrizzleJobRepository implements JobRepository {
  constructor(
    @Inject(getDrizzleToken()) private readonly database: Database,
    private readonly queue: QueueService,
  ) {}

  async hasSubmission(idempotencyKey: string): Promise<boolean> {
    const [existing] = await this.database
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.idempotencyKey, idempotencyKey));
    return existing !== undefined;
  }

  async create(
    input: CreateEmailJobInput,
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
        priority: input.priority,
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
      const queuedId = await this.queue.boss.send(EMAIL_QUEUE, input.payload, {
        db: fromDrizzle(tx, sql),
        id,
        priority: input.priority,
        retryBackoff: true,
        retryDelay: 60,
        retryLimit: 3,
        startAfter: startAt,
      });
      if (queuedId !== id) throw new Error('Queue insertion did not return the assigned job ID.');
      return { duplicate: false, id, startAt };
    });
  }

  async get(id: string): Promise<EmailJob | null> {
    const [row] = await this.database.select().from(jobs).where(eq(jobs.id, id));
    if (!row) return null;
    const [queued] = await this.queue.boss.findJobs(EMAIL_QUEUE, { id });
    const status = queued ? this.queueStatus(queued.state, queued.startAfter) : row.status;
    if (status !== row.status) {
      await this.database
        .update(jobs)
        .set({ status, updatedAt: new Date() })
        .where(eq(jobs.id, id));
    }
    if (queued?.state === 'retry' || queued?.state === 'failed') {
      const attempt = queued.retryCount + 1;
      await this.database
        .insert(jobActivity)
        .values({
          attempt,
          errorCategory: 'worker_interrupted',
          event: 'attempt_failed',
          eventKey: `attempt_failed:${attempt}`,
          jobId: id,
          recordedAt: sql`clock_timestamp()`,
        })
        .onConflictDoNothing();
      if (queued.state === 'failed') {
        await this.database
          .insert(jobActivity)
          .values({
            attempt,
            errorCategory: 'worker_interrupted',
            event: 'failed',
            eventKey: 'failed',
            jobId: id,
            recordedAt: sql`clock_timestamp()`,
          })
          .onConflictDoNothing();
      }
    }
    const activity = await this.database
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
    return {
      activity,
      id: row.id,
      priority: row.priority,
      result: row.result,
      startAt: row.startAt,
      status,
    };
  }

  async cancel(id: string): Promise<'cancelled' | 'not_found' | 'not_cancellable'> {
    return this.database.transaction(async (tx) => {
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, id)).for('update');
      if (!row) return 'not_found';
      if (row.status !== 'scheduled' && row.status !== 'pending') return 'not_cancellable';
      await tx.execute(
        sql`SELECT id FROM pgboss.job WHERE name = ${EMAIL_QUEUE} AND id = ${id}::uuid FOR UPDATE`,
      );
      const [queueJob] = await this.queue.boss.findJobs(EMAIL_QUEUE, {
        db: fromDrizzle(tx, sql),
        id,
      });
      if (!queueJob || (queueJob.state !== 'created' && queueJob.state !== 'retry'))
        return 'not_cancellable';
      await this.queue.boss.cancel(EMAIL_QUEUE, id, { db: fromDrizzle(tx, sql) });
      const [cancelled] = await this.queue.boss.findJobs(EMAIL_QUEUE, {
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

  private queueStatus(state: string, startAfter: Date): EmailJob['status'] {
    switch (state) {
      case 'created':
      case 'retry':
        return startAfter.getTime() > Date.now() ? 'scheduled' : 'pending';
      case 'active':
        return 'processing';
      case 'cancelled':
        return 'cancelled';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        throw new Error('Unknown queue state.');
    }
  }

  async recordStart(id: string, attempt: number): Promise<void> {
    await this.database.transaction(async (tx) => {
      for (let previous = 1; previous < attempt; previous++) {
        await tx
          .insert(jobActivity)
          .values({
            attempt: previous,
            event: 'started',
            eventKey: `started:${previous}`,
            jobId: id,
            recordedAt: sql`clock_timestamp()`,
          })
          .onConflictDoNothing();
        await tx
          .insert(jobActivity)
          .values({
            attempt: previous,
            errorCategory: 'worker_interrupted',
            event: 'attempt_failed',
            eventKey: `attempt_failed:${previous}`,
            jobId: id,
            recordedAt: sql`clock_timestamp()`,
          })
          .onConflictDoNothing();
      }
      await tx
        .update(jobs)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(jobs.id, id));
      await tx
        .insert(jobActivity)
        .values({
          attempt,
          event: 'started',
          eventKey: `started:${attempt}`,
          jobId: id,
          recordedAt: sql`clock_timestamp()`,
        })
        .onConflictDoNothing();
    });
  }

  async recordFailure(
    id: string,
    attempt: number,
    category: string,
    terminal: boolean,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({ status: terminal ? 'failed' : 'scheduled', updatedAt: new Date() })
        .where(eq(jobs.id, id));
      await tx
        .insert(jobActivity)
        .values({
          attempt,
          errorCategory: category,
          event: 'attempt_failed',
          eventKey: `attempt_failed:${attempt}`,
          jobId: id,
          recordedAt: sql`clock_timestamp()`,
        })
        .onConflictDoNothing();
      if (terminal)
        await tx
          .insert(jobActivity)
          .values({
            attempt,
            errorCategory: category,
            event: 'failed',
            eventKey: 'failed',
            jobId: id,
            recordedAt: sql`clock_timestamp()`,
          })
          .onConflictDoNothing();
    });
  }

  async recordCompletion(id: string, attempt: number, emailId: string): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({ result: { emailId }, status: 'completed', updatedAt: new Date() })
        .where(eq(jobs.id, id));
      await tx
        .insert(jobActivity)
        .values({
          attempt,
          event: 'completed',
          eventKey: 'completed',
          jobId: id,
          recordedAt: sql`clock_timestamp()`,
        })
        .onConflictDoNothing();
    });
  }

  async reconcileProcessing(): Promise<void> {
    const processing = await this.database
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.status, 'processing'));
    for (const row of processing) {
      const [queued] = await this.queue.boss.findJobs(EMAIL_QUEUE, { id: row.id });
      if (queued?.state === 'retry' || queued?.state === 'failed') {
        await this.recordFailure(
          row.id,
          queued.retryCount + 1,
          'worker_interrupted',
          queued.state === 'failed',
        );
      }
    }
  }
}
