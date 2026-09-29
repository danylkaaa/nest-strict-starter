import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ApiException } from '@/app/http/api-exception.js'
import { toErrorEnvelope } from '@/app/http/to-error-envelope.js'

describe('toErrorEnvelope', () => {
  it('keeps the code and status of an ApiException', () => {
    const result = toErrorEnvelope(
      new ApiException(HttpStatus.CONFLICT, 'ORDER_PAID', 'Already paid'),
    )
    expect(result).toEqual({
      status: 409,
      body: { ok: false, error: { code: 'ORDER_PAID', message: 'Already paid' } },
    })
  })

  it('derives the code from the status of a plain HttpException', () => {
    const result = toErrorEnvelope(new NotFoundException('Cannot GET /nope'))
    expect(result).toEqual({
      status: 404,
      body: { ok: false, error: { code: 'NOT_FOUND', message: 'Cannot GET /nope' } },
    })
  })

  it('maps a validation message list to VALIDATION_FAILED', () => {
    const result = toErrorEnvelope(
      new BadRequestException({ message: ['a is required', 'b must be a number'] }),
    )
    expect(result).toEqual({
      status: 400,
      body: {
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: 'a is required; b must be a number' },
      },
    })
  })

  it('hides the details of unknown errors', () => {
    const result = toErrorEnvelope(new Error('db password is hunter2'))
    expect(result).toEqual({
      status: 500,
      body: { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    })
  })
})
