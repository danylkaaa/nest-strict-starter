import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { DomainError } from '@/app/base/domain-error.js';
import { toHttpException } from '@/app/http/errors/to-http-exception.js';

import type { HttpExceptionClass } from '@/app/http/errors/to-http-exception.js';

class SampleError<N extends string> extends DomainError {
  override readonly name: N;

  constructor(name: N, message: string) {
    super(message);
    this.name = name;
  }
}

type FirstError = SampleError<'FirstError'>;
type SecondError = SampleError<'SecondError'>;
type ErrorUnion = FirstError | SecondError;

const HTTP_EXCEPTION_FOR = {
  FirstError: BadRequestException,
  SecondError: InternalServerErrorException,
} satisfies Record<ErrorUnion['name'], HttpExceptionClass>;

const toException = (error: ErrorUnion) =>
  // @ts-expect-error SecondError is not listed in the map
  toHttpException(error, { FirstError: BadRequestException });

describe('toHttpException', () => {
  it('builds the mapped exception with the error name as code and its message', () => {
    const error: ErrorUnion = new SampleError('FirstError', 'Nope.');

    const exception = toHttpException(error, HTTP_EXCEPTION_FOR);

    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      code: 'FirstError',
      message: 'Nope.',
    });
  });

  it('picks the exception class by the error name', () => {
    const error: ErrorUnion = new SampleError('SecondError', 'Boom.');

    const exception = toHttpException(error, HTTP_EXCEPTION_FOR);

    expect(exception).toBeInstanceOf(InternalServerErrorException);
    expect(exception.getStatus()).toBe(500);
  });

  it('rejects a map that misses an error name at compile time', () => {
    expect(toException(new SampleError('FirstError', 'Nope.'))).toBeInstanceOf(BadRequestException);
  });
});
