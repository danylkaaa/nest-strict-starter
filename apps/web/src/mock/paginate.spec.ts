import { describe, expect, it } from 'vitest';

import { paginate } from './paginate';

const items = Array.from({ length: 25 }, (_, index) => index);

describe('paginate', () => {
  it('returns the requested page slice and totals', () => {
    expect(paginate(items, { page: 2, pageSize: 10 })).toEqual({
      items: items.slice(10, 20),
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it('clamps a page past the end to the last page', () => {
    expect(paginate(items, { page: 9, pageSize: 10 })).toMatchObject({
      items: [20, 21, 22, 23, 24],
      page: 3,
    });
  });

  it('reports one page for an empty list', () => {
    expect(paginate([], { page: 1, pageSize: 10 })).toMatchObject({ items: [], totalPages: 1 });
  });
});
