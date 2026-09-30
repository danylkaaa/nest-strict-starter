import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { AIRCRAFT_REPORT_QUEUE, EMAIL_QUEUE, WEBHOOK_QUEUE } from '@/common/queue/queue.service.js';
import { ValidateAircraftTransitRequestUseCase } from '@/modules/aircraft-transits/use-case/validate-aircraft-transit-request.use-case.js';
import {
  JobBatchConflictError,
  JobBatchItemInvalidError,
  JobScheduleError,
} from '@/modules/jobs/job.errors.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import { isValidSchedule } from './submit-job.js';

import type { DomainError } from '@/common/errors/domain-error.js';
import type { CreateJobBatchInput, JobBatchItem } from '@/modules/jobs/job-batch.js';
import type { JobBatchCreateError } from '@/modules/jobs/job.errors.js';
import type { BatchChildInsert, JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

@Injectable()
export class CreateJobBatchUseCase {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly repository: JobRepository,
    private readonly validateTransit: ValidateAircraftTransitRequestUseCase,
  ) {}

  /**
   * Checks the batch key first, then the shared schedule, then every child in submitted order
   * (the first invalid one is reported by its 1-based position). Nothing is written until all
   * pass; the repository then creates the batch, children, events, and queue jobs atomically.
   */
  async execute(
    input: CreateJobBatchInput,
  ): Promise<Result<{ id: string; startAt: Date }, JobBatchCreateError>> {
    const existingBatchId = await this.repository.findBatchSubmission(input.idempotencyKey);
    if (existingBatchId !== null) return err(new JobBatchConflictError(existingBatchId));
    if (!isValidSchedule(input)) return err(new JobScheduleError());
    const items: BatchChildInsert[] = [];
    for (const [index, item] of input.items.entries()) {
      const child = await this.toChild(item);
      if (child.isErr()) return err(new JobBatchItemInvalidError(index + 1, child.error));
      items.push(child.value);
    }
    const created = await this.repository.createBatch({
      idempotencyKey: input.idempotencyKey,
      items,
      maxAttempts: input.maxAttempts,
      priority: input.priority,
      startAt: input.type === 'schedule' ? input.startAt : undefined,
      type: input.type,
    });
    return created.duplicate
      ? err(new JobBatchConflictError(created.id))
      : ok({ id: created.id, startAt: created.startAt });
  }

  private async toChild(item: JobBatchItem): Promise<Result<BatchChildInsert, DomainError>> {
    const idempotencyKey = randomUUID();
    if (item.type === 'email')
      return ok({ idempotencyKey, payload: item.payload, queue: EMAIL_QUEUE });
    if (item.type === 'webhook')
      return ok({ idempotencyKey, payload: item.payload, queue: WEBHOOK_QUEUE });
    const validated = await this.validateTransit.execute(item.payload);
    if (validated.isErr()) return err(validated.error);
    return ok({
      idempotencyKey,
      payload: { ...item.payload, departureAt: item.payload.departureAt.toISOString() },
      queue: AIRCRAFT_REPORT_QUEUE,
    });
  }
}
