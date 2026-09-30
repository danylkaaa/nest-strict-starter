import { DomainError } from '@/common/errors/domain-error.js';

export class EmailDeliveryFailedError extends DomainError {
  override readonly name = 'EmailDeliveryFailedError';

  constructor() {
    super('The email could not be delivered. Please try again.');
  }
}
