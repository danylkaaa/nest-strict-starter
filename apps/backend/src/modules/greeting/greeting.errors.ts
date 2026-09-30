import { DomainError } from '@/common/errors/domain-error';

export class GreetingNameEmptyError extends DomainError {
  override readonly name = 'GreetingNameEmptyError';
  constructor(message = 'Please enter a name.') {
    super(message);
  }
}

export type GreetingError = GreetingNameEmptyError;
