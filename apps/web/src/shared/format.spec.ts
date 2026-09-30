import { describe, expect, it } from 'vitest';

import { formatDate, formatMinutes, formatNumber, formatUtcDateTime } from './format';

describe('format', () => {
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
