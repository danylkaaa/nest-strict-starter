import { DomainError } from '@/common/errors/domain-error.js';

export class JobNotFoundError extends DomainError {
  override readonly name = 'JobNotFoundError';
  constructor() {
    super('Job not found.');
  }
}
export class JobConflictError extends DomainError {
  override readonly name = 'JobConflictError';
  constructor(readonly existingJobId: string) {
    super('The idempotency key was already used.');
  }
}
export class JobNotCancellableError extends DomainError {
  override readonly name = 'JobNotCancellableError';
  constructor() {
    super('This job cannot be cancelled.');
  }
}
export class JobNotRetryableError extends DomainError {
  override readonly name = 'JobNotRetryableError';
  constructor() {
    super('Only a failed job can be retried.');
  }
}
export class JobScheduleError extends DomainError {
  override readonly name = 'JobScheduleError';
  constructor() {
    super('Scheduled jobs require a future startAt.');
  }
}
export type JobError =
  | JobNotFoundError
  | JobConflictError
  | JobNotCancellableError
  | JobNotRetryableError
  | JobScheduleError;

export class JobBatchNotFoundError extends DomainError {
  override readonly name = 'JobBatchNotFoundError';
  constructor() {
    super('Job batch not found.');
  }
}
export class JobBatchConflictError extends DomainError {
  override readonly name = 'JobBatchConflictError';
  constructor(readonly existingBatchId: string) {
    super('The batch idempotency key was already used.');
  }
}
export class JobBatchNotCancellableError extends DomainError {
  override readonly name = 'JobBatchNotCancellableError';
  constructor() {
    super('This batch has already finished and cannot be cancelled.');
  }
}
/** A child of a batch failed validation; `position` is 1-based and `cause` is the feature error. */
export class JobBatchItemInvalidError extends DomainError {
  override readonly name = 'JobBatchItemInvalidError';
  constructor(
    readonly position: number,
    readonly reason: DomainError,
  ) {
    super(`Batch item ${position} is invalid: ${reason.message}`);
  }
}
export type JobBatchCreateError =
  | JobBatchConflictError
  | JobScheduleError
  | JobBatchItemInvalidError;
