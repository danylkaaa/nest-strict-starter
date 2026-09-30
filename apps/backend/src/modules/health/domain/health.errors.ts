import { DomainError } from '@/app/base/domain-error.js';

export class PostgresUnavailableError extends DomainError {
  override readonly name = 'PostgresUnavailableError';

  constructor(message = 'The database is temporarily unavailable. Please try again shortly.') {
    super(message);
  }
}
