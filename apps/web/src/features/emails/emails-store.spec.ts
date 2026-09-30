import { beforeEach, describe, expect, it } from 'vitest';

import { initialEmailsState, useEmailsStore } from './emails-store';

const state = () => useEmailsStore.getState();

describe('emails store', () => {
  beforeEach(() => {
    useEmailsStore.setState(initialEmailsState);
  });

  it('toggles one expanded row at a time', () => {
    state().toggleExpanded('job_a');
    state().toggleExpanded('job_b');
    expect(state().expandedId).toBe('job_b');

    state().toggleExpanded('job_b');
    expect(state().expandedId).toBeNull();
  });

  it('collapses the open row when the page changes', () => {
    state().toggleExpanded('job_a');
    state().setPage(3);

    expect(state()).toMatchObject({ expandedId: null, page: 3 });
  });

  it('returns to the first page when a filter changes', () => {
    state().setPage(3);
    state().setSearch('invoice');
    expect(state().page).toBe(1);

    state().setPage(2);
    state().setStatus('failed');
    expect(state()).toMatchObject({ page: 1, status: 'failed' });
  });
});
