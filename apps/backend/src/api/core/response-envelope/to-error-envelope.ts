import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import { failure } from './envelope.js';

import type { ErrorEnvelope } from './envelope.js';

const BAD_REQUEST = 400;
const INTERNAL_SERVER_ERROR = 500;
const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/** A business code carried by a `{ code, message }` object response, if any. */
function codeOf(exception: HttpException): string | undefined {
  const response = exception.getResponse();
  if (typeof response !== 'object') return undefined;
  const code = (response as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function messageOf(exception: HttpException): { message: string; isList: boolean } {
  const response = exception.getResponse();
  if (typeof response === 'string') return { isList: false, message: response };
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) return { isList: true, message: message.join('; ') };
  return { isList: false, message: typeof message === 'string' ? message : exception.message };
}

/** Pure mapping from any thrown value to an HTTP status and the error envelope body. */
export function toErrorEnvelope(exception: unknown): { status: number; body: ErrorEnvelope } {
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

  // Nest exceptions: thrown by controllers/guards (with an optional business `code`) or by the framework.
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const { message, isList } = messageOf(exception);
    // A message list is what ValidationPipe produces for a rejected payload.
    const code =
      codeOf(exception) ??
      (isList && status === BAD_REQUEST
        ? 'VALIDATION_FAILED'
        : (HttpStatus[status] ?? 'HTTP_ERROR'));
    return { body: failure(code, message), status };
  }

  // Anything else is a bug: never leak its details.
  return {
    body: failure(INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE),
    status: INTERNAL_SERVER_ERROR,
  };
}
