import type { DomainError } from '@/common/errors/domain-error';
import type { HttpException } from '@nestjs/common';

export interface HttpExceptionResponse {
  code: string;
  message: string;
}

export type HttpExceptionClass = new (response: HttpExceptionResponse) => HttpException;

/**
 * Maps a domain error to an HTTP exception carrying the `{ code, message }` envelope convention.
 * The exception class is looked up by `error.name` in `exceptionFor`, which must list every
 * error name of the union (a missing one fails to compile).
 */
export const toHttpException = <E extends DomainError>(
  error: E,
  exceptionFor: Record<E['name'], HttpExceptionClass>,
): HttpException => {
  const ExceptionClass = exceptionFor[error.name as E['name']];
  return new ExceptionClass({ code: error.name, message: error.message });
};
