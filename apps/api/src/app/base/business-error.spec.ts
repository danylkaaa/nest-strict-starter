import { describe, expect, it } from 'vitest'

import { BusinessError, DEFAULT_BUSINESS_ERROR_MESSAGE } from '@/app/base/business-error.js'

class PlainError extends BusinessError {
  override readonly name = 'PlainError'
}

class FriendlyError extends BusinessError {
  override readonly name = 'FriendlyError'
  constructor(message = 'Please pick another name.') {
    super(message)
  }
}

describe('business error', () => {
  it('is an Error', () => {
    expect(new PlainError()).toBeInstanceOf(Error)
  })

  it('falls back to the generic user-friendly message', () => {
    expect(new PlainError().message).toBe(DEFAULT_BUSINESS_ERROR_MESSAGE)
  })

  it('lets a subclass define its own default message', () => {
    expect(new FriendlyError().message).toBe('Please pick another name.')
  })

  it('accepts an explicit message', () => {
    expect(new FriendlyError('Taken.').message).toBe('Taken.')
  })
})
