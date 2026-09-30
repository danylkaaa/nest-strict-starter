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
