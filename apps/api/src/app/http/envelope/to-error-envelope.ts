import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import { failure } from '@/app/http/envelope/envelope.js';
import { HttpError, InternalServerError } from '@/app/http/errors/http-errors.js';

import type { ErrorEnvelope } from '@/app/http/envelope/envelope.js';

const BAD_REQUEST = 400;

function messageOf(exception: HttpException): { message: string; isList: boolean } {
  const response = exception.getResponse();
  if (typeof response === 'string') return { isList: false, message: response };
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) return { isList: true, message: message.join('; ') };
  return { isList: false, message: typeof message === 'string' ? message : exception.message };
}

/** Pure mapping from any thrown value to an HTTP status and the error envelope body. */
export function toErrorEnvelope(exception: unknown): { status: number; body: ErrorEnvelope } {
  if (exception instanceof HttpError) {
    return { body: failure(exception.name, exception.message), status: exception.statusCode };
  }

  // A request DTO (body, query, params) failed its zod schema.
  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError();
    const message =
      zodError instanceof ZodError
        ? zodError.issues
            .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
            .join('; ')
        : exception.message;
    return { body: failure('VALIDATION_FAILED', message), status: BAD_REQUEST };
  }

  // Errors raised by the framework itself (unknown route, rejected payload, ...).
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const { message, isList } = messageOf(exception);
    // A message list is what ValidationPipe produces for a rejected payload.
    const code =
      isList && status === BAD_REQUEST ? 'VALIDATION_FAILED' : (HttpStatus[status] ?? 'HTTP_ERROR');
    return { body: failure(code, message), status };
  }

  // Anything else is a bug: never leak its details.
  const internal = new InternalServerError();
  return { body: failure(internal.name, internal.message), status: internal.statusCode };
}
