import { describe, expect, it } from 'vitest';

import { toAttempts, toBatchLogs, toTransitReport, toUiBatch, toUiJob } from './mappers';

import type {
  ApiActivity,
  ApiBatchActivityEntry,
  ApiBatchChild,
  ApiBatchSummary,
  ApiJob,
} from './schemas';
import type { Airport } from '@/features/jobs/job';

let counter = 0;
const event = (
  name: ApiActivity['event'],
  attempt: number | null,
  at: string,
  errorCategory: string | null = null,
): ApiActivity => {
  counter += 1;
  return { attempt, errorCategory, event: name, id: `jac_${counter}`, recordedAt: at };
};

const emailJob: ApiJob = {
  attempts: 2,
  batchId: null,
  completedAt: '2026-10-01T10:05:00.000Z',
  createdAt: '2026-10-01T10:00:00.000Z',
  id: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  lastErrorCategory: 'delivery_failed',
  maxAttempts: 4,
  payload: { body: 'Hello', recipient: 'a@example.com', subject: 'Hi' },
  priority: 3,
  queue: 'email',
  result: { emailId: 'eml_1' },
  startAt: '2026-10-01T10:00:00.100Z',
  status: 'completed',
};

const airports = new Map<string, Airport>([
  ['KJFK', { city: 'New York', code: 'JFK', lat: 40.6, lon: -73.8, name: 'JFK' }],
  ['EGLL', { city: 'London', code: 'LHR', lat: 51.5, lon: -0.5, name: 'Heathrow' }],
]);

describe('toAttempts', () => {
  it('pairs each start with its outcome and marks the retry or the last attempt', () => {
    const attempts = toAttempts([
      event('created', null, '2026-10-01T10:00:00.000Z'),
      event('started', 1, '2026-10-01T10:00:01.000Z'),
      event('attempt_failed', 1, '2026-10-01T10:00:02.000Z', 'delivery_failed'),
      event('started', 2, '2026-10-01T10:01:02.000Z'),
      event('attempt_failed', 2, '2026-10-01T10:01:03.000Z', 'invalid_payload'),
      event('failed', 2, '2026-10-01T10:01:03.000Z', 'invalid_payload'),
    ]);

    expect(attempts).toEqual([
      {
        finishedAt: '2026-10-01T10:00:02.000Z',
        next: 'retry scheduled',
        number: 1,
        outcome: 503,
        startedAt: '2026-10-01T10:00:01.000Z',
      },
      {
        finishedAt: '2026-10-01T10:01:03.000Z',
        next: 'gave up',
        number: 2,
        outcome: 400,
        startedAt: '2026-10-01T10:01:02.000Z',
      },
    ]);
  });

  it('reports a finished attempt as 200 and an unfinished one without an outcome', () => {
    const [done] = toAttempts([
      event('started', 1, '2026-10-01T10:00:01.000Z'),
      event('completed', 1, '2026-10-01T10:00:02.000Z'),
    ]);
    const [running] = toAttempts([event('started', 1, '2026-10-01T10:00:01.000Z')]);

    expect(done?.outcome).toBe(200);
    expect(running).toMatchObject({ finishedAt: null, outcome: null });
  });
});

describe('toUiJob', () => {
  it('maps an email job to the UI contract', () => {
    const job = toUiJob(emailJob, { airports });

    expect(job).toMatchObject({
      payload: { body: 'Hello', subject: 'Hi', to: 'a@example.com' },
      progress: 100,
      result: { messageId: 'eml_1' },
      runAt: null,
      type: 'email',
    });
  });

  it('shows a scheduled run time only when the start is later than creation', () => {
    const job = toUiJob(
      { ...emailJob, startAt: '2026-10-01T11:00:00.000Z', status: 'scheduled' },
      { airports },
    );

    expect(job.runAt).toBe('2026-10-01T11:00:00.000Z');
  });

  it('describes the last error of a failed job', () => {
    const job = toUiJob({ ...emailJob, result: null, status: 'failed' }, { airports });

    expect(job.error).toBe('Delivery failed');
  });

  it('shows a transit route with the IATA codes of the UI', () => {
    const job = toUiJob(
      {
        ...emailJob,
        payload: {
          aircraftId: 'acf_1',
          departureAt: '2026-10-03T12:00:00.000Z',
          destinationIcao: 'EGLL',
          originIcao: 'KJFK',
        },
        queue: 'aircraft-report',
        result: { reportId: 'atr_1' },
      },
      { airports },
    );

    expect(job).toMatchObject({
      payload: { departureAt: '2026-10-03T12:00:00.000Z', destination: 'LHR', origin: 'JFK' },
      type: 'transit',
    });
  });

  it('wraps a non-object webhook body so the form can show it', () => {
    const job = toUiJob(
      {
        ...emailJob,
        payload: { method: 'POST', payload: [1, 2], url: 'https://hooks.example.com/a' },
        queue: 'webhook',
        result: { webhookCallId: 'whc_1' },
      },
      { airports },
    );

    expect(job).toMatchObject({
      payload: { body: { value: [1, 2] } },
      result: { statusCode: 200 },
      type: 'webhook',
    });
  });
});

const point = (latitude: number) => ({
  altitudeM: 0,
  latitude,
  longitude: 0,
  speedKmh: 800,
  timestamp: '2026-10-03T12:00:00.000Z',
});

describe('toTransitReport', () => {
  it('converts units and spreads the path fractions evenly', () => {
    const airport = { city: 'X', iata: 'XXX', icao: 'XXXX', latitude: 1, longitude: 2, name: 'X' };
    const report = toTransitReport({
      aircraft: {
        cruiseAltitudeM: 10_668,
        cruiseSpeedKmh: 926,
        id: 'acf_1',
        model: 'A320',
        registration: 'N123',
      },
      arrivalAt: '2026-10-03T14:00:00.000Z',
      departureAt: '2026-10-03T12:00:00.000Z',
      destination: airport,
      distanceKm: 100,
      durationMinutes: 120,
      origin: airport,
      waypoints: [point(0), point(1), point(2)],
    });

    expect(report.aircraft).toMatchObject({ cruiseAltitudeFt: 35_000, cruiseSpeedKt: 500 });
    expect(report.path.map((p) => p.fraction)).toEqual([0, 0.5, 1]);
  });
});

const batchSummary: ApiBatchSummary = {
  cancellationRequestedAt: null,
  counts: { cancelled: 0, completed: 1, failed: 1, pending: 0, processing: 1, scheduled: 0 },
  createdAt: '2026-10-01T10:00:00.000Z',
  id: '44444444-4444-4444-8444-444444444444',
  idempotencyKey: '55555555-5555-4555-8555-555555555555',
  maxAttempts: 3,
  priority: 2,
  progress: 67,
  startAt: '2026-10-01T10:00:00.000Z',
  status: 'processing',
  total: 3,
};

const child = (
  id: string,
  status: ApiBatchChild['status'],
  completedAt: string | null = null,
): Extract<ApiBatchChild, { queue: 'email' }> => ({
  attempts: 1,
  completedAt,
  id,
  lastErrorCategory: null,
  link: `/api/jobs/${id}`,
  payload: { body: 'Hello', recipient: 'a@example.com', subject: 'Hi' },
  position: 1,
  queue: 'email',
  result: null,
  status,
});

const transitChild: ApiBatchChild = {
  attempts: 0,
  completedAt: null,
  id: 'a',
  lastErrorCategory: null,
  link: '/api/jobs/a',
  payload: {
    aircraftId: 'acf_1',
    departureAt: '2026-10-03T12:00:00.000Z',
    destinationIcao: 'EGLL',
    originIcao: 'KJFK',
  },
  position: 1,
  queue: 'aircraft-report',
  result: null,
  status: 'pending',
};

describe('toUiBatch', () => {
  it('maps a batch detail to the job contract with children in order', () => {
    const batch = toUiBatch(batchSummary, {
      airports,
      children: [
        { ...child('a', 'completed', '2026-10-01T10:00:05.000Z'), result: { emailId: 'eml_1' } },
        child('b', 'failed', '2026-10-01T10:00:09.000Z'),
        child('c', 'processing'),
      ],
    });

    expect(batch).toMatchObject({
      batchChildIds: ['a', 'b', 'c'],
      batchId: null,
      batchItems: ['done', 'failed', 'running'],
      batchStatus: 'processing',
      completedAt: null,
      maxAttempts: 3,
      priority: 2,
      progress: 67,
      result: null,
      runAt: null,
      status: 'processing',
      type: 'batch',
    });
    expect(batch).toHaveProperty('payload.items.length', 3);
  });

  it('shows cancelled tasks and a cancelling batch as processing in filters', () => {
    const batch = toUiBatch(
      { ...batchSummary, status: 'cancelling' },
      {
        children: [child('a', 'cancelled'), child('b', 'processing')],
      },
    );

    expect(batch).toMatchObject({
      batchItems: ['cancelled', 'running'],
      batchStatus: 'cancelling',
      status: 'processing',
    });
  });

  it('summarizes a finished batch and takes its completion from the last child', () => {
    const batch = toUiBatch(
      {
        ...batchSummary,
        counts: { cancelled: 1, completed: 1, failed: 1, pending: 0, processing: 0, scheduled: 0 },
        progress: 100,
        status: 'completed_with_errors',
      },
      {
        children: [
          child('a', 'completed', '2026-10-01T10:00:05.000Z'),
          child('b', 'failed', '2026-10-01T10:00:09.000Z'),
          child('c', 'cancelled', '2026-10-01T10:00:07.000Z'),
        ],
      },
    );

    expect(batch).toMatchObject({
      completedAt: '2026-10-01T10:00:09.000Z',
      result: { cancelled: 1, failed: 1, processed: 3, succeeded: 1 },
      status: 'failed',
    });
  });

  it('shows a scheduled start and needs no children for a list row', () => {
    const batch = toUiBatch(
      { ...batchSummary, startAt: '2026-10-01T12:00:00.000Z', status: 'scheduled' },
      {},
    );

    expect(batch).toMatchObject({
      batchItems: [],
      runAt: '2026-10-01T12:00:00.000Z',
      status: 'scheduled',
    });
  });

  it('shows a transit task with IATA codes', () => {
    const batch = toUiBatch(batchSummary, {
      airports,
      children: [transitChild],
    });

    expect(batch).toMatchObject({
      payload: { items: [{ payload: { destination: 'LHR', origin: 'JFK' }, type: 'transit' }] },
    });
  });
});

const entry = (overrides: Partial<ApiBatchActivityEntry>): ApiBatchActivityEntry => ({
  attempt: null,
  errorCategory: null,
  event: 'created',
  id: 'jac_1',
  jobId: 'child-1',
  position: 1,
  queue: 'email',
  recordedAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

describe('toBatchLogs', () => {
  it('keeps the feed order and prefixes task events with position and type', () => {
    const logs = toBatchLogs([
      entry({ event: 'batch_created', jobId: null, position: null, queue: null }),
      entry({ position: 3, queue: 'webhook', recordedAt: '2026-10-01T10:00:01.000Z' }),
      entry({
        attempt: 2,
        errorCategory: 'delivery_failed',
        event: 'attempt_failed',
        position: 3,
        queue: 'aircraft-report',
        recordedAt: '2026-10-01T10:00:02.000Z',
      }),
      entry({
        event: 'cancellation_requested',
        jobId: null,
        position: null,
        queue: null,
        recordedAt: '2026-10-01T10:00:03.000Z',
      }),
    ]);

    expect(logs).toEqual([
      { at: '2026-10-01T10:00:00.000Z', level: 'info', message: 'Batch created' },
      { at: '2026-10-01T10:00:01.000Z', level: 'info', message: 'Task 3 · webhook: Job created' },
      {
        at: '2026-10-01T10:00:02.000Z',
        level: 'warning',
        message: 'Task 3 · transit: Attempt 2 failed: Delivery failed',
      },
      { at: '2026-10-01T10:00:03.000Z', level: 'info', message: 'Cancellation requested' },
    ]);
  });

  it('gives a terminal failure the error level', () => {
    const [log] = toBatchLogs([
      entry({ attempt: 4, errorCategory: 'invalid_payload', event: 'failed' }),
    ]);
    expect(log).toMatchObject({
      level: 'error',
      message: 'Task 1 · email: Gave up after attempt 4: Invalid payload',
    });
  });
});
