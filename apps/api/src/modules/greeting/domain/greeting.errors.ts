import { BusinessError } from '@/app/base/business-error.js';

export class GreetingNameEmptyError extends BusinessError {
  override readonly name = 'GreetingNameEmptyError';
  constructor(message = 'Please enter a name.') {
    super(message);
  }
}

export type GreetingError = GreetingNameEmptyError;
