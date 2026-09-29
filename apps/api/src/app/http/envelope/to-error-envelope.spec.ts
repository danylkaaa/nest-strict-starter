import { BadRequestException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { toErrorEnvelope } from '@/app/http/envelope/to-error-envelope.js'
import { ConflictError } from '@/app/http/errors/http-errors.js'

describe('toErrorEnvelope', () => {
  it('uses the status and name of an HttpError', () => {
    const result = toErrorEnvelope(new ConflictError('This order is already paid.'))
    expect(result).toEqual({
      status: 409,
      body: { ok: false, error: { code: 'CONFLICT', message: 'This order is already paid.' } },
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
