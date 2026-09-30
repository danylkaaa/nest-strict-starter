import { DomainError } from '@/app/base/domain-error.js';

export class InvalidCredentialsError extends DomainError {
  override readonly name = 'InvalidCredentialsError';
  constructor(message = 'Email or password is incorrect.') {
    super(message);
  }
}

export class UserLookupError extends DomainError {
  override readonly name = 'UserLookupError';
  constructor(message = 'We could not sign you in. Please try again.') {
    super(message);
  }
}

export class PasswordVerificationError extends DomainError {
  override readonly name = 'PasswordVerificationError';
  constructor(message = 'We could not sign you in. Please try again.') {
    super(message);
  }
}

export type AuthError = InvalidCredentialsError | UserLookupError | PasswordVerificationError;
