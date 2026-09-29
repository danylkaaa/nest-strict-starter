import { HttpException, HttpStatus } from '@nestjs/common'

import { failure } from '@/app/http/envelope/envelope.js'
import { HttpError, InternalServerError } from '@/app/http/errors/http-errors.js'

import type { ErrorEnvelope } from '@/app/http/envelope/envelope.js'

const BAD_REQUEST = 400

function messageOf(exception: HttpException): { message: string; isList: boolean } {
  const response = exception.getResponse()
  if (typeof response === 'string') return { message: response, isList: false }
  const message = (response as { message?: unknown }).message
  if (Array.isArray(message)) return { message: message.join('; '), isList: true }
  return { message: typeof message === 'string' ? message : exception.message, isList: false }
}

/** Pure mapping from any thrown value to an HTTP status and the error envelope body. */
export function toErrorEnvelope(exception: unknown): { status: number; body: ErrorEnvelope } {
  if (exception instanceof HttpError) {
    return { status: exception.statusCode, body: failure(exception.name, exception.message) }
  }

  // Errors raised by the framework itself (unknown route, rejected payload, ...).
  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    const { message, isList } = messageOf(exception)
    // A message list is what ValidationPipe produces for a rejected payload.
    const code =
      isList && status === BAD_REQUEST ? 'VALIDATION_FAILED' : (HttpStatus[status] ?? 'HTTP_ERROR')
    return { status, body: failure(code, message) }
  }

  // Anything else is a bug: never leak its details.
  const internal = new InternalServerError()
  return { status: internal.statusCode, body: failure(internal.name, internal.message) }
}
