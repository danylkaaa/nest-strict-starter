import { describe, expect, it } from 'vitest';

import { shortenId } from './format';

describe('shortenId', () => {
  it('keeps the first 8 characters', () => {
    expect(shortenId('3f9a1c2e-7b4d-4e8f-9a1b-2c3d4e5f6a7b')).toBe('3f9a1c2e');
  });

  it('returns short ids unchanged', () => {
    expect(shortenId('abc')).toBe('abc');
  });
});
