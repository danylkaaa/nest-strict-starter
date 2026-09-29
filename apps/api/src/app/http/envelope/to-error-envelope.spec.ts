import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toErrorEnvelope } from '@/app/http/envelope/to-error-envelope.js';
import { ConflictError } from '@/app/http/errors/http-errors.js';

describe('toErrorEnvelope', () => {
  it('uses the status and name of an HttpError', () => {
    const result = toErrorEnvelope(new ConflictError('This order is already paid.'));
    expect(result).toEqual({
      body: { error: { code: 'CONFLICT', message: 'This order is already paid.' }, ok: false },
      status: 409,
    });
  });

  it('derives the code from the status of a plain HttpException', () => {
    const result = toErrorEnvelope(new NotFoundException('Cannot GET /nope'));
    expect(result).toEqual({
      body: { error: { code: 'NOT_FOUND', message: 'Cannot GET /nope' }, ok: false },
      status: 404,
    });
  });

  it('maps a zod DTO failure to VALIDATION_FAILED with the field path', () => {
    const parsed = z
      .object({ user: z.object({ age: z.number() }) })
      .safeParse({ user: { age: 'x' } });
    const result = toErrorEnvelope(new ZodValidationException(parsed.error));
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
    expect(result.body.error.message).toContain('user.age');
  });

  it('maps a validation message list to VALIDATION_FAILED', () => {
    const result = toErrorEnvelope(
      new BadRequestException({ message: ['a is required', 'b must be a number'] }),
    );
    expect(result).toEqual({
      body: {
        error: { code: 'VALIDATION_FAILED', message: 'a is required; b must be a number' },
        ok: false,
      },
      status: 400,
    });
  });

  it('hides the details of unknown errors', () => {
    const result = toErrorEnvelope(new Error('db password is hunter2'));
    expect(result).toEqual({
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }, ok: false },
      status: 500,
    });
  });
});
