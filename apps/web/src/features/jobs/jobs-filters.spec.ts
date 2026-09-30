import { describe, expect, it } from 'vitest';

import { parseJobsFilters } from './jobs-filters';

describe('parseJobsFilters', () => {
  it('defaults to the first page with no filters', () => {
    expect(parseJobsFilters(new URLSearchParams())).toEqual({ page: 1, pageSize: 10 });
  });

  it('reads status, type, search, and page', () => {
    expect(
      parseJobsFilters(new URLSearchParams('status=failed&type=webhook&q=order&page=3')),
    ).toEqual({ page: 3, pageSize: 10, search: 'order', status: 'failed', type: 'webhook' });
  });

  it('ignores unknown values', () => {
    expect(parseJobsFilters(new URLSearchParams('status=lost&type=fax&page=-2'))).toEqual({
      page: 1,
      pageSize: 10,
    });
  });
});
