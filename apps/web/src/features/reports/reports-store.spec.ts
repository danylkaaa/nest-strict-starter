import { beforeEach, describe, expect, it } from 'vitest';

import { initialReportsState, useReportsStore } from './reports-store';

describe('useReportsStore', () => {
  beforeEach(() => {
    useReportsStore.setState(initialReportsState);
  });

  it('returns to the first page when a filter changes', () => {
    useReportsStore.getState().setPage(3);
    useReportsStore.getState().setStatus('failed');
    expect(useReportsStore.getState()).toMatchObject({ page: 1, status: 'failed' });

    useReportsStore.getState().setPage(3);
    useReportsStore.getState().setSearch('LHR');
    expect(useReportsStore.getState()).toMatchObject({ page: 1, search: 'LHR' });
  });

  it('keeps the filters when only the page changes', () => {
    useReportsStore.getState().setSearch('LHR');
    useReportsStore.getState().setPage(2);

    expect(useReportsStore.getState()).toMatchObject({ page: 2, search: 'LHR' });
  });
});
