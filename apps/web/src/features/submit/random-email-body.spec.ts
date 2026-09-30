import { describe, expect, it } from 'vitest';

import { randomEmailBody } from './random-email-body';

const sequence = (...values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length]!;
};

describe('randomEmailBody', () => {
  it('greets the recipient by the name before @', () => {
    expect(randomEmailBody('priya@northwind.co', sequence(0))).toMatch(/^Hi priya,\n\n/u);
  });

  it('falls back to a generic greeting without a recipient', () => {
    expect(randomEmailBody('', sequence(0))).toMatch(/^Hi there,\n\n/u);
  });

  it('ends with a sign-off', () => {
    expect(randomEmailBody('ana@example.com', sequence(0.5))).toMatch(/\n\n\S.*,\n\S.*$/u);
  });

  it('produces different bodies for different random values', () => {
    expect(randomEmailBody('ana@example.com', sequence(0))).not.toBe(
      randomEmailBody('ana@example.com', sequence(0.9)),
    );
  });
});
