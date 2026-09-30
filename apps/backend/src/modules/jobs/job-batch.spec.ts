import { describe, expect, it } from 'vitest';

import { batchProgress, countByStatus, deriveBatchStatus, summarizeBatch } from './job-batch.js';
import { jobBatchRecord } from './testing/fixtures.js';

import type { ChildProgress } from './job-batch.js';
import type { JobStatus } from './job.js';

const NOW = new Date('2030-06-01T12:00:00Z');
const past = new Date('2030-05-01T00:00:00Z');
const future = new Date('2030-07-01T00:00:00Z');

const child = (status: JobStatus, attempts = 0): ChildProgress => ({ attempts, status });

describe('batch progress', () => {
  it('is zero when nothing finished, including a processing child', () => {
    const children = [child('pending'), child('processing', 1), child('scheduled')];
    expect(batchProgress(countByStatus(children), children.length)).toBe(0);
  });

  it('counts completed, failed, and cancelled children as finished and rounds', () => {
    const children = [
      child('completed', 1),
      child('failed', 4),
      child('cancelled'),
      child('pending'),
    ];
    expect(batchProgress(countByStatus(children), 4)).toBe(75);
    const thirds = [child('completed', 1), child('pending'), child('pending')];
    expect(batchProgress(countByStatus(thirds), 3)).toBe(33);
    const twoThirds = [child('completed', 1), child('completed', 1), child('pending')];
    expect(batchProgress(countByStatus(twoThirds), 3)).toBe(67);
  });

  it('is 100 when every child is terminal', () => {
    const children = [child('completed', 1), child('failed', 4)];
    expect(batchProgress(countByStatus(children), 2)).toBe(100);
  });
});

const batch = (overrides: Parameters<typeof jobBatchRecord>[0] = {}) =>
  jobBatchRecord({ startAt: past, ...overrides });

describe('batch status derivation', () => {
  it('is scheduled before a future start, even with retry-waiting children', () => {
    expect(deriveBatchStatus(batch({ startAt: future }), [child('scheduled')], NOW)).toBe(
      'scheduled',
    );
  });

  it('is pending when eligible and no child has started', () => {
    expect(deriveBatchStatus(batch(), [child('pending'), child('scheduled')], NOW)).toBe('pending');
  });

  it.each([
    ['a processing child', [child('processing', 1), child('pending')]],
    ['a finished child with others waiting', [child('completed', 1), child('pending')]],
    ['a child waiting for a retry', [child('scheduled', 1), child('pending')]],
  ])('is processing with %s', (_name, children) => {
    expect(deriveBatchStatus(batch(), children, NOW)).toBe('processing');
  });

  it('is completed when every child succeeded', () => {
    expect(deriveBatchStatus(batch(), [child('completed', 1), child('completed', 1)], NOW)).toBe(
      'completed',
    );
  });

  it('is completed_with_errors when a child failed or was cancelled individually', () => {
    expect(deriveBatchStatus(batch(), [child('completed', 1), child('failed', 4)], NOW)).toBe(
      'completed_with_errors',
    );
    expect(deriveBatchStatus(batch(), [child('completed', 1), child('cancelled')], NOW)).toBe(
      'completed_with_errors',
    );
  });

  it('is cancelling while a child is unfinished, then cancelled whatever the outcomes', () => {
    const cancelled = batch({ cancellationRequestedAt: past });
    expect(deriveBatchStatus(cancelled, [child('cancelled'), child('processing', 1)], NOW)).toBe(
      'cancelling',
    );
    expect(deriveBatchStatus(cancelled, [child('cancelled'), child('completed', 1)], NOW)).toBe(
      'cancelled',
    );
    expect(deriveBatchStatus(cancelled, [child('failed', 1), child('cancelled')], NOW)).toBe(
      'cancelled',
    );
  });

  it('summarizes counts, total, progress, and status together', () => {
    const summary = summarizeBatch(batch(), [child('completed', 1), child('processing', 1)], NOW);
    expect(summary).toMatchObject({
      counts: { cancelled: 0, completed: 1, failed: 0, pending: 0, processing: 1, scheduled: 0 },
      progress: 50,
      status: 'processing',
      total: 2,
    });
  });
});
