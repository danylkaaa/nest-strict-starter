import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from './ports/job.repository.js';

import type { Job, JobResult } from './job.js';
import type { JobRepository, JobTransition } from './ports/job.repository.js';

@Injectable()
export class JobService {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async cancel(id: string): Promise<'cancelled' | 'not_found' | 'not_cancellable'> {
    const row = await this.repository.getJob(id);
    if (!row) return 'not_found';
    // A batch child is cancelled only through its batch, which owns the retry and race rules.
    if (row.batchId !== null) return 'not_cancellable';
    return this.repository.cancelJob(row.queue, id);
  }

  /**
   * Grants a failed job one more attempt. The status is reconciled with the queue first, because a
   * job that failed while no read or recovery pass ran is still stored as processing.
   */
  async retry(id: string): Promise<'retried' | 'not_found' | 'not_retryable'> {
    const job = await this.get(id);
    if (!job) return 'not_found';
    if (job.batchId !== null || job.status !== 'failed') return 'not_retryable';
    return this.repository.retryJob(job.queue, id);
  }

  async get(id: string): Promise<Job | null> {
    const row = await this.repository.getJob(id);
    if (!row) return null;
    const queued = await this.repository.getQueueJob(row.queue, id);
    const status = queued ? this.queueStatus(queued.state, queued.startAfter) : row.status;
    if (status !== row.status) await this.repository.setJobStatus(id, status);
    if (queued?.state === 'retry' || queued?.state === 'failed') {
      const attempt = queued.retryCount + 1;
      await this.repository.addJobLog(
        id,
        'attempt_failed',
        `attempt_failed:${attempt}`,
        attempt,
        'worker_interrupted',
      );
      if (queued.state === 'failed')
        await this.repository.addJobLog(
          id,
          'failed',
          `failed:${attempt}`,
          attempt,
          'worker_interrupted',
        );
    }
    // Re-read so the figures derived from activity (attempts, completion time) include the events
    // and status written above.
    const current = (await this.repository.getJob(id)) ?? row;
    return { ...current, activity: await this.repository.getJobActivity(id), status };
  }

  async reconcileProcessing(): Promise<void> {
    for (const { id, queue } of await this.repository.listProcessingJobs()) {
      const queued = await this.repository.getQueueJob(queue, id);
      if (queued?.state === 'retry' || queued?.state === 'failed')
        await this.recordFailure(
          id,
          queued.retryCount + 1,
          'worker_interrupted',
          queued.state === 'failed',
        );
    }
  }

  async recordStart(id: string, attempt: number): Promise<boolean> {
    const logs: JobTransition['logs'] = [];
    for (let previous = 1; previous < attempt; previous++) {
      logs.push(
        { attempt: previous, event: 'started', eventKey: `started:${previous}` },
        {
          attempt: previous,
          errorCategory: 'worker_interrupted',
          event: 'attempt_failed',
          eventKey: `attempt_failed:${previous}`,
        },
      );
    }
    logs.push({ attempt, event: 'started', eventKey: `started:${attempt}` });
    const status = await this.repository.writeJobTransition(id, {
      logs,
      skipIfBatchCancelled: { attempt },
      status: 'processing',
    });
    return status !== 'failed';
  }

  /**
   * Records a failed attempt and returns whether it was the last one. The job's own `maxAttempts`
   * decides: the worker's pg-boss job carries no retry limit, and a retry raises the row and the
   * queue limit together, so the row always agrees with pg-boss. `deadLetter` forces a terminal
   * failure for input errors that never succeed on retry.
   */
  async recordFailure(
    id: string,
    attempt: number,
    category: string,
    deadLetter: boolean,
  ): Promise<{ terminal: boolean }> {
    const row = await this.repository.getJob(id);
    const terminal = deadLetter || (row !== null && attempt >= row.maxAttempts);
    const logs: JobTransition['logs'] = [
      {
        attempt,
        errorCategory: category,
        event: 'attempt_failed',
        eventKey: `attempt_failed:${attempt}`,
      },
    ];
    if (terminal)
      // Keyed by attempt: a retried job can fail terminally again, and that is a new event.
      logs.push({
        attempt,
        errorCategory: category,
        event: 'failed',
        eventKey: `failed:${attempt}`,
      });
    // A batch child must not run more business work once its batch is cancelled. The repository
    // decides under the child row lock whether this failure is terminal for the application job;
    // a queue retry after a crash is dead-lettered at its next claim.
    const written = await this.repository.writeJobTransition(id, {
      ...(!terminal && (row?.batchId ?? null) !== null
        ? { failedAttemptInCancelledBatch: { attempt, category } }
        : {}),
      logs,
      status: terminal ? 'failed' : 'scheduled',
    });
    return { terminal: written === 'failed' };
  }

  async recordCompletion(id: string, attempt: number, result: JobResult): Promise<void> {
    await this.repository.writeJobTransition(id, {
      logs: [{ attempt, event: 'completed', eventKey: 'completed' }],
      result,
      status: 'completed',
    });
  }

  private queueStatus(state: string, startAfter: Date): Job['status'] {
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
}
