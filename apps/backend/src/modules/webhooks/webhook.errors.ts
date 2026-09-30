import { DomainError } from '@/common/errors/domain-error.js';

export class WebhookDeliveryFailedError extends DomainError {
  override readonly name = 'WebhookDeliveryFailedError';

  constructor() {
    super('The webhook could not be delivered. Please try again.');
  }
}
