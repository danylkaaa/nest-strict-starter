/**
 * Base class for errors that map to an HTTP response. `name` is the stable, machine-readable
 * code clients switch on; `message` is user-friendly. Only `presentation/` code creates these.
 * Extend a status class and override `name` when clients must tell two failures apart.
 */
export abstract class HttpError extends Error {
  abstract readonly statusCode: number
}

export class BadRequestError extends HttpError {
  override readonly name: string = 'BAD_REQUEST'
  readonly statusCode = 400
  constructor(message = 'The request is invalid.') {
    super(message)
  }
}

export class UnauthorizedError extends HttpError {
  override readonly name: string = 'UNAUTHORIZED'
  readonly statusCode = 401
  constructor(message = 'Please sign in to continue.') {
    super(message)
  }
}

export class ForbiddenError extends HttpError {
  override readonly name: string = 'FORBIDDEN'
  readonly statusCode = 403
  constructor(message = 'You do not have access to this resource.') {
    super(message)
  }
}

export class NotFoundError extends HttpError {
  override readonly name: string = 'NOT_FOUND'
  readonly statusCode = 404
  constructor(message = 'The requested resource was not found.') {
    super(message)
  }
}

export class ConflictError extends HttpError {
  override readonly name: string = 'CONFLICT'
  readonly statusCode = 409
  constructor(message = 'The request conflicts with the current state.') {
    super(message)
  }
}

export class UnprocessableEntityError extends HttpError {
  override readonly name: string = 'UNPROCESSABLE_ENTITY'
  readonly statusCode = 422
  constructor(message = 'The request could not be processed.') {
    super(message)
  }
}

export class InternalServerError extends HttpError {
  override readonly name: string = 'INTERNAL_ERROR'
  readonly statusCode = 500
  constructor(message = 'Internal server error') {
    super(message)
  }
}
