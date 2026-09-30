import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { toErrorEnvelope } from './to-error-envelope.js';

describe('toErrorEnvelope', () => {
  it('carries the business code, message, and details of an object response', () => {
    const { body, status } = toErrorEnvelope(
      new ConflictException({
        code: 'JobConflictError',
        details: { existingJobId: 'job-1' },
        message: 'Used.',
      }),
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      error: { code: 'JobConflictError', details: { existingJobId: 'job-1' }, message: 'Used.' },
      ok: false,
    });
  });

  it('omits details when the response has none', () => {
    const { body } = toErrorEnvelope(new NotFoundException({ code: 'Missing', message: 'Gone.' }));
    expect(body).toEqual({ error: { code: 'Missing', message: 'Gone.' }, ok: false });
  });

  it('never leaks the details of an unexpected error', () => {
    const { body, status } = toErrorEnvelope(new Error('secret'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});
