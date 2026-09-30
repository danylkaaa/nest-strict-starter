import { describe, expect, it } from 'vitest';

import { formatDate, formatMinutes, formatNumber, formatUtcDateTime, shortId } from './format';

describe('format', () => {
  it('shortens an ID to its first block', () => {
    expect(shortId('78628bfa-7baf-45cd-811b-247b022fed45')).toBe('78628bfa');
  });

  it('formats a UTC calendar date', () => {
    expect(formatDate('2026-10-03T09:00:00Z')).toBe('3 Oct 2026');
  });

  it('formats a UTC day and time', () => {
    expect(formatUtcDateTime('2026-10-03T16:12:00Z')).toBe('3 Oct 16:12 UTC');
  });

  it('formats durations in hours and minutes', () => {
    expect(formatMinutes(432)).toBe('7 h 12 min');
    expect(formatMinutes(45)).toBe('45 min');
  });

  it('rounds and groups numbers', () => {
    expect(formatNumber(5539.6)).toBe('5,540');
  });
});
