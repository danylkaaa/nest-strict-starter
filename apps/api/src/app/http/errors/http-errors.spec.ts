import { describe, expect, it } from 'vitest'

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '@/app/http/errors/http-errors.js'

describe('http errors', () => {
  it.each([
    [new BadRequestError(), 400, 'BAD_REQUEST'],
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError(), 409, 'CONFLICT'],
    [new UnprocessableEntityError(), 422, 'UNPROCESSABLE_ENTITY'],
    [new InternalServerError(), 500, 'INTERNAL_ERROR'],
  ])('%o has status %i and name %s', (error, statusCode, name) => {
    expect(error).toBeInstanceOf(HttpError)
    expect(error).toBeInstanceOf(Error)
    expect(error.statusCode).toBe(statusCode)
    expect(error.name).toBe(name)
    expect(error.message).not.toBe('')
  })

  it('accepts a custom message', () => {
    expect(new NotFoundError('Article 42 does not exist.').message).toBe(
      'Article 42 does not exist.',
    )
  })
})
