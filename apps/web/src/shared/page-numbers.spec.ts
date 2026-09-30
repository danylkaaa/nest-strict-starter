import { describe, expect, it } from 'vitest';

import { pageNumbers } from './page-numbers';

describe('pageNumbers', () => {
  it('lists every page when there are few', () => {
    expect(pageNumbers(2, 3)).toEqual([1, 2, 3]);
  });

  it('collapses skipped pages into gaps around the current page', () => {
    expect(pageNumbers(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9]);
  });

  it('keeps a single gap at the edges', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 'gap', 5]);
  });
});
