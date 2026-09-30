import { describe, expect, it } from 'vitest';

import { DomainError, DEFAULT_DOMAIN_ERROR_MESSAGE } from '@/app/base/domain-error.js';

class PlainError extends DomainError {
  override readonly name = 'PlainError';
}

class FriendlyError extends DomainError {
  override readonly name = 'FriendlyError';
  constructor(message = 'Please pick another name.') {
    super(message);
  }
}

describe('domain error', () => {
  it('is an Error', () => {
    expect(new PlainError()).toBeInstanceOf(Error);
  });

  it('falls back to the generic user-friendly message', () => {
    expect(new PlainError().message).toBe(DEFAULT_DOMAIN_ERROR_MESSAGE);
  });

  it('lets a subclass define its own default message', () => {
    expect(new FriendlyError().message).toBe('Please pick another name.');
  });

  it('accepts an explicit message', () => {
    expect(new FriendlyError('Taken.').message).toBe('Taken.');
  });
});
