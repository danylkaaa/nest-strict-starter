import { HttpException, HttpStatus } from '@nestjs/common'

import { ApiException } from '@/app/http/api-exception.js'
import { failure } from '@/app/http/envelope.js'

import type { ErrorEnvelope } from '@/app/http/envelope.js'

const BAD_REQUEST = 400
const INTERNAL_MESSAGE = 'Internal server error'

function messageOf(exception: HttpException): { message: string; isList: boolean } {
  const response = exception.getResponse()
  if (typeof response === 'string') return { message: response, isList: false }
  const message = (response as { message?: unknown }).message
  if (Array.isArray(message)) return { message: message.join('; '), isList: true }
  return { message: typeof message === 'string' ? message : exception.message, isList: false }
}

/** Pure mapping from any thrown value to an HTTP status and the error envelope body. */
export function toErrorEnvelope(exception: unknown): { status: number; body: ErrorEnvelope } {
  if (exception instanceof ApiException) {
    return {
      status: exception.getStatus(),
      body: failure(exception.code, exception.message),
    }
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    const { message, isList } = messageOf(exception)
    // A message list is what ValidationPipe produces for a rejected payload.
    const code =
      isList && status === BAD_REQUEST ? 'VALIDATION_FAILED' : (HttpStatus[status] ?? 'HTTP_ERROR')
    return { status, body: failure(code, message) }
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: failure('INTERNAL_ERROR', INTERNAL_MESSAGE),
  }
}
