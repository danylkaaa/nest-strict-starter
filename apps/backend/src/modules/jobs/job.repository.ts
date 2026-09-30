import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { jobActivity, jobs } from '@workspace/database/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { fromDrizzle } from 'pg-boss';

import { QueueService } from '@/common/queue/queue.service.js';
import { RETRY_POLICY } from '@/common/queue/retry-policy.js';

import type { CreateJobInput, Job } from './job.js';
import type { JobRepository, JobTransition } from './ports/job.repository.js';
import type { QueueName } from '@/common/queue/queue.service.js';
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
        ...RETRY_POLICY,
        db: fromDrizzle(tx, sql),
        id,
        priority: input.priority,
        startAfter: startAt,
      });
      if (queuedId !== id) throw new Error('Queue insertion did not return the assigned job ID.');
      return { duplicate: false, id, startAt };
    });
  }

  async getJob(id: string): Promise<Omit<Job, 'activity'> | null> {
    const [row] = await this.database.select().from(jobs).where(eq(jobs.id, id));
    return row
      ? {
          id: row.id,
          priority: row.priority,
          queue: row.queue,
          result: row.result,
          startAt: row.startAt,
          status: row.status,
        }
      : null;
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
