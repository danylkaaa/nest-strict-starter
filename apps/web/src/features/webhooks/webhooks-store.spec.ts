import { beforeEach, describe, expect, it } from 'vitest';

import { initialWebhooksState, useWebhooksStore } from './webhooks-store';

describe('useWebhooksStore', () => {
  beforeEach(() => {
    useWebhooksStore.setState(initialWebhooksState);
  });

  it('collapses the open row when the page changes', () => {
    useWebhooksStore.getState().toggleExpanded('a');
    useWebhooksStore.getState().setPage(2);

    expect(useWebhooksStore.getState()).toMatchObject({ expandedId: null, page: 2 });
  });

  it('returns to the first page when a filter changes', () => {
    useWebhooksStore.getState().setPage(3);
    useWebhooksStore.getState().setStatus('failed');
    expect(useWebhooksStore.getState()).toMatchObject({ page: 1, status: 'failed' });

    useWebhooksStore.getState().setPage(3);
    useWebhooksStore.getState().setSearch('orders');
    expect(useWebhooksStore.getState()).toMatchObject({ page: 1, search: 'orders' });
  });

  it('toggles the same row closed again', () => {
    useWebhooksStore.getState().toggleExpanded('a');
    useWebhooksStore.getState().toggleExpanded('a');

    expect(useWebhooksStore.getState().expandedId).toBeNull();
  });
});
