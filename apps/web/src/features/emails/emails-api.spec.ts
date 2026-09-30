import { describe, expect, it } from 'vitest';

import { fetchEmails, paginate } from './emails-api';

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

  it('returns a partial last page', () => {
    expect(paginate(items, { page: 3, pageSize: 10 }).items).toEqual([20, 21, 22, 23, 24]);
  });

  it('reports one page for an empty list', () => {
    expect(paginate([], { page: 1, pageSize: 10 })).toMatchObject({ items: [], totalPages: 1 });
  });
});

describe('fetchEmails', () => {
  it('resolves a page of simulated emails', async () => {
    const result = await fetchEmails({ page: 1, pageSize: 5 }, 0);

    expect(result.items).toHaveLength(5);
    expect(result.total).toBeGreaterThan(5);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        body: expect.any(String),
        id: expect.any(String),
        recipient: expect.stringContaining('@'),
        sentAt: expect.any(String),
        subject: expect.any(String),
      }),
    );
  });
});
