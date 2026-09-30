import { describe, expect, it } from 'vitest';

import { createSeededMockServer } from './seed';

describe('createSeededMockServer', () => {
  const server = createSeededMockServer(() => Date.UTC(2026, 9, 1, 12));

  it('starts with history across every status', () => {
    const { counts } = server.getHealth();

    for (const status of ['scheduled', 'pending', 'processing', 'completed', 'failed'] as const) {
      expect(counts[status]).toBeGreaterThan(0);
    }
  });

  it('has enough finished emails to page through', () => {
    expect(server.listEmails({ page: 1, pageSize: 10 }).totalPages).toBeGreaterThan(2);
  });

  it('has a batch in progress', () => {
    const batch = server.listJobs({ page: 1, pageSize: 5, status: 'processing', type: 'batch' });

    expect(batch.items[0]?.progress).toBeGreaterThan(0);
  });
});
