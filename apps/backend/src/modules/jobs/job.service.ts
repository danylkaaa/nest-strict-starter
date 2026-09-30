import { Inject, Injectable } from '@nestjs/common';

import { JOB_REPOSITORY } from './ports/job.repository.js';

import type { EmailJob } from './job.js';
import type { JobRepository, JobTransition } from './ports/job.repository.js';

@Injectable()
export class JobService {
  constructor(@Inject(JOB_REPOSITORY) private readonly repository: JobRepository) {}

  async cancel(id: string): Promise<'cancelled' | 'not_found' | 'not_cancellable'> {
    return this.repository.cancelJob(id);
  }

  async get(id: string): Promise<EmailJob | null> {
    const row = await this.repository.getJob(id);
    if (!row) return null;
    const queued = await this.repository.getQueueJob(id);
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
        await this.repository.addJobLog(id, 'failed', 'failed', attempt, 'worker_interrupted');
    }
    return { ...row, activity: await this.repository.getJobActivity(id), status };
  }

  async reconcileProcessing(): Promise<void> {
    for (const id of await this.repository.listProcessingJobIds()) {
      const queued = await this.repository.getQueueJob(id);
      if (queued?.state === 'retry' || queued?.state === 'failed')
        await this.recordFailure(
          id,
          queued.retryCount + 1,
          'worker_interrupted',
          queued.state === 'failed',
        );
    }
  }

  async recordStart(id: string, attempt: number): Promise<void> {
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
    await this.repository.writeJobTransition(id, { logs, status: 'processing' });
  }

  async recordFailure(
    id: string,
    attempt: number,
    category: string,
    terminal: boolean,
  ): Promise<void> {
    const logs: JobTransition['logs'] = [
      {
        attempt,
        errorCategory: category,
        event: 'attempt_failed',
        eventKey: `attempt_failed:${attempt}`,
      },
    ];
    if (terminal)
      logs.push({ attempt, errorCategory: category, event: 'failed', eventKey: 'failed' });
    await this.repository.writeJobTransition(id, {
      logs,
      status: terminal ? 'failed' : 'scheduled',
    });
  }

  async recordCompletion(id: string, attempt: number, emailId: string): Promise<void> {
    await this.repository.writeJobTransition(id, {
      logs: [{ attempt, event: 'completed', eventKey: 'completed' }],
      result: { emailId },
      status: 'completed',
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
}
