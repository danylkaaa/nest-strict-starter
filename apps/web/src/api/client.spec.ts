import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiBatch, ApiBatchSummary, ApiJob } from './schemas';
import type { SubmitJobInput } from '@/features/jobs/job';

// The client keeps no batch state: every call reads the backend, so a full page reload (a fresh
// module instance, here `vi.resetModules()`) shows the same batches. `fetch` is stubbed with the
// backend's response shapes.

interface Call {
  body: unknown;
  method: string;
  path: string;
}

type Handler = (call: Call) => { data?: unknown; error?: unknown; status?: number };

const calls: Call[] = [];

const stubApi = (routes: Record<string, Handler>) => {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: { body?: string; method?: string }) => {
      const method = init?.method ?? 'GET';
      const call: Call = {
        body: init?.body === undefined ? undefined : JSON.parse(init.body),
        method,
        path: url.replace('/api', ''),
      };
      calls.push(call);
      const handler = routes[`${method} ${call.path}`];
      if (handler === undefined) throw new Error(`Unexpected call ${method} ${call.path}`);
      const { data, error, status = 200 } = handler(call);
      return Promise.resolve(
        new Response(
          JSON.stringify(error === undefined ? { data, ok: true } : { error, ok: false }),
          {
            status,
          },
        ),
      );
    }),
  );
};

const loadClient = async () => {
  vi.resetModules();
  return (await import('./client')).api;
};

const counts = (overrides: Partial<Record<string, number>> = {}) => ({
  cancelled: 0,
  completed: 0,
  failed: 0,
  pending: 0,
  processing: 0,
  scheduled: 0,
  ...overrides,
});

const summary = (id: string, createdAt: string, overrides: Partial<ApiBatchSummary> = {}) => ({
  cancellationRequestedAt: null,
  counts: counts({ pending: 2 }),
  createdAt,
  id,
  idempotencyKey: '55555555-5555-4555-8555-555555555555',
  maxAttempts: 3,
  priority: 2,
  progress: 0,
  startAt: createdAt,
  status: 'pending' as const,
  total: 2,
  ...overrides,
});

const apiJob = (id: string, createdAt: string): ApiJob => ({
  attempts: 0,
  batchId: null,
  completedAt: null,
  createdAt,
  id,
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  lastErrorCategory: null,
  maxAttempts: 4,
  payload: { body: 'Hello', recipient: 'a@example.com', subject: 'Hi' },
  priority: 3,
  queue: 'email',
  result: null,
  startAt: createdAt,
  status: 'pending',
});

const page = <T>(items: T[], total = items.length) => ({
  data: { items, page: 1, pageSize: 100, total, totalPages: 1 },
});

const airports = {
  data: {
    items: [
      { city: 'Tokyo', iata: 'HND', icao: 'RJTT', latitude: 35, longitude: 139, name: 'Haneda' },
      {
        city: 'San Francisco',
        iata: 'SFO',
        icao: 'KSFO',
        latitude: 37,
        longitude: -122,
        name: 'SFO',
      },
    ],
  },
};
const aircraft = {
  data: {
    items: [
      {
        cruiseAltitudeM: 13_000,
        cruiseSpeedKmh: 900,
        id: 'acf_1',
        model: 'B789',
        registration: 'JA1',
      },
    ],
  },
};

const batchDetail = (overrides: Partial<ApiBatch> = {}): ApiBatch => ({
  ...summary('batch-1', '2026-10-01T10:00:00.000Z'),
  items: [
    {
      attempts: 0,
      completedAt: null,
      id: 'child-1',
      lastErrorCategory: null,
      link: '/api/jobs/child-1',
      payload: { body: 'Hi', recipient: 'a@example.com', subject: 'Hello' },
      position: 1,
      queue: 'email',
      result: null,
      status: 'pending',
    },
    {
      attempts: 0,
      completedAt: null,
      id: 'child-2',
      lastErrorCategory: null,
      link: '/api/jobs/child-2',
      payload: {
        aircraftId: 'acf_1',
        departureAt: '2031-01-01T10:00:00.000Z',
        destinationIcao: 'KSFO',
        originIcao: 'RJTT',
      },
      position: 2,
      queue: 'aircraft-report',
      result: null,
      status: 'pending',
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-10-01T10:00:00.000Z'), toFake: ['Date'] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const submitRoutes = (): Record<string, Handler> => ({
  'GET /aircraft': () => aircraft,
  'GET /airports': () => airports,
  'GET /job-batches/batch-1': () => ({ data: batchDetail() }),
  'POST /job-batches': () => ({ data: { id: 'batch-1', startAt: '2026-10-01T10:00:00.000Z' } }),
});

describe('submitting a batch', () => {
  const form: Extract<SubmitJobInput, { type: 'batch' }> = {
    idempotencyKey: '66666666-6666-4666-8666-666666666666',
    maxAttempts: 3,
    payload: {
      items: [
        { payload: { body: 'Hi', subject: 'Hello', to: 'a@example.com' }, type: 'email' },
        {
          payload: { body: { a: 1 }, method: 'PUT', url: 'https://example.com/hook' },
          type: 'webhook',
        },
        {
          payload: { departureAt: '2031-01-01T10:00:00.000Z', destination: 'SFO', origin: 'HND' },
          type: 'transit',
        },
      ],
    },
    priority: 4,
    type: 'batch',
  };

  it('maps the form to the batch request, transit as aircraft-report with ICAO codes', async () => {
    stubApi(submitRoutes());
    const api = await loadClient();

    const result = await api.submitJob(form);

    expect(result).toMatchObject({ created: true, job: { id: 'batch-1', type: 'batch' } });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      idempotencyKey: form.idempotencyKey,
      items: [
        { payload: { body: 'Hi', recipient: 'a@example.com', subject: 'Hello' }, type: 'email' },
        {
          payload: { method: 'PUT', payload: { a: 1 }, url: 'https://example.com/hook' },
          type: 'webhook',
        },
        {
          payload: {
            aircraftId: 'acf_1',
            departureAt: '2031-01-01T10:00:00.000Z',
            destinationIcao: 'KSFO',
            originIcao: 'RJTT',
          },
          type: 'aircraft-report',
        },
      ],
      maxAttempts: 3,
      priority: 4,
      type: 'instant',
    });
  });

  it('sends the shared start for a scheduled batch', async () => {
    stubApi(submitRoutes());
    const api = await loadClient();

    await api.submitJob({ ...form, runAt: '2026-10-01T12:00:00.000Z' });

    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      startAt: '2026-10-01T12:00:00.000Z',
      type: 'schedule',
    });
  });

  it('returns the existing batch when the key was already used', async () => {
    stubApi({
      ...submitRoutes(),
      'POST /job-batches': () => ({
        error: {
          code: 'JobBatchConflictError',
          details: { existingBatchId: 'batch-1' },
          message: 'The batch idempotency key was already used.',
        },
        status: 409,
      }),
    });
    const api = await loadClient();

    await expect(api.submitJob(form)).resolves.toMatchObject({
      created: false,
      job: { id: 'batch-1' },
    });
  });

  it('surfaces the position of an invalid task', async () => {
    stubApi({
      ...submitRoutes(),
      'POST /job-batches': () => ({
        error: {
          code: 'JobBatchItemInvalidError',
          details: { position: 3, reason: 'UnknownAirportError' },
          message: 'Batch item 3 is invalid: Unknown airport.',
        },
        status: 400,
      }),
    });
    const api = await loadClient();

    await expect(api.submitJob(form)).rejects.toMatchObject({
      code: 'JobBatchItemInvalidError',
      message: 'Batch item 3 is invalid: Unknown airport.',
    });
  });
});

const jobsRoute = (items: ApiJob[]) => () => page(items);
const batchesRoute = (items: ApiBatchSummary[]) => () => page(items);

describe('the mixed jobs list', () => {
  it('merges standalone jobs and batch parents newest first, paged', async () => {
    stubApi({
      'GET /airports': () => airports,
      'GET /job-batches?page=1&pageSize=100': batchesRoute([
        summary('batch-new', '2026-10-01T10:04:00.000Z'),
        summary('batch-old', '2026-10-01T10:01:00.000Z'),
      ]),
      'GET /jobs?page=1&pageSize=100': jobsRoute([
        apiJob('job-3', '2026-10-01T10:03:00.000Z'),
        apiJob('job-2', '2026-10-01T10:02:00.000Z'),
        apiJob('job-0', '2026-10-01T10:00:00.000Z'),
      ]),
    });
    const api = await loadClient();

    const first = await api.listJobs({ page: 1, pageSize: 3 });
    const second = await api.listJobs({ page: 2, pageSize: 3 });

    expect(first.items.map((job) => job.id)).toEqual(['batch-new', 'job-3', 'job-2']);
    expect(second.items.map((job) => job.id)).toEqual(['batch-old', 'job-0']);
    expect(first).toMatchObject({ page: 1, total: 5, totalPages: 2 });
    expect(first.items[0]).toMatchObject({ batchItems: [], type: 'batch' });
  });

  it('lists only batches for the batch type and filters them by status', async () => {
    stubApi({
      'GET /airports': () => airports,
      'GET /job-batches?page=1&pageSize=100': batchesRoute([
        summary('batch-a', '2026-10-01T10:03:00.000Z', { status: 'completed_with_errors' }),
        summary('batch-b', '2026-10-01T10:02:00.000Z', { status: 'cancelling' }),
        summary('batch-c', '2026-10-01T10:01:00.000Z', { status: 'completed' }),
      ]),
    });
    const api = await loadClient();

    const failed = await api.listJobs({ page: 1, pageSize: 10, status: 'failed', type: 'batch' });
    const processing = await api.listJobs({
      page: 1,
      pageSize: 10,
      status: 'processing',
      type: 'batch',
    });

    expect(failed.items.map((job) => job.id)).toEqual(['batch-a']);
    expect(failed.total).toBe(1);
    expect(processing.items.map((job) => job.id)).toEqual(['batch-b']);
    expect(calls.every((call) => !call.path.startsWith('/jobs'))).toBe(true);
  });

  it('asks the API for standalone jobs only when a job type is chosen', async () => {
    stubApi({
      'GET /airports': () => airports,
      'GET /jobs?page=1&pageSize=10&queue=email': jobsRoute([
        apiJob('job-1', '2026-10-01T10:00:00.000Z'),
      ]),
    });
    const api = await loadClient();

    const result = await api.listJobs({ page: 1, pageSize: 10, type: 'email' });

    expect(result.items.map((job) => job.id)).toEqual(['job-1']);
    expect(calls.some((call) => call.path.startsWith('/job-batches'))).toBe(false);
  });
});

describe('cancelling a batch', () => {
  it('sends DELETE to the batch endpoint and returns the cancelling batch', async () => {
    stubApi({
      'DELETE /job-batches/batch-1': () => ({ data: batchDetail({ status: 'cancelling' }) }),
      'GET /airports': () => airports,
      'GET /job-batches/batch-1': () => ({ data: batchDetail({ status: 'cancelling' }) }),
    });
    const api = await loadClient();

    const job = await api.cancelBatch('batch-1');

    expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/job-batches/batch-1' });
    expect(job).toMatchObject({ batchStatus: 'cancelling', status: 'processing', type: 'batch' });
  });

  it('reports a finished batch as a conflict', async () => {
    stubApi({
      'DELETE /job-batches/batch-1': () => ({
        error: { code: 'JobBatchNotCancellableError', message: 'This batch has already finished.' },
        status: 409,
      }),
    });
    const api = await loadClient();

    await expect(api.cancelBatch('batch-1')).rejects.toMatchObject({
      code: 'JobBatchNotCancellableError',
    });
  });
});

describe('a batch after a full page reload', () => {
  it('is read back from the backend by a fresh client with the same tasks and progress', async () => {
    const detail = batchDetail({ progress: 50, status: 'processing' });
    stubApi({
      'GET /airports': () => airports,
      'GET /job-batches/batch-1': () => ({ data: detail }),
    });

    const before = await (await loadClient()).getBatch('batch-1');
    const after = await (await loadClient()).getBatch('batch-1');

    expect(after).toEqual(before);
    expect(after).toMatchObject({
      batchChildIds: ['child-1', 'child-2'],
      batchStatus: 'processing',
      progress: 50,
      type: 'batch',
    });
    expect(after).toHaveProperty('payload.items.1.payload.destination', 'SFO');
  });
});

describe('batch activity', () => {
  it('reads the batch feed endpoint and maps it to logs with task positions', async () => {
    stubApi({
      'GET /job-batches/batch-1/activity': () => ({
        data: {
          items: [
            {
              attempt: null,
              errorCategory: null,
              event: 'batch_created',
              id: 'batch_created:batch-1',
              jobId: null,
              position: null,
              queue: null,
              recordedAt: '2026-10-01T10:00:00.000Z',
            },
            {
              attempt: 1,
              errorCategory: null,
              event: 'started',
              id: 'jac_1',
              jobId: 'child-2',
              position: 2,
              queue: 'webhook',
              recordedAt: '2026-10-01T10:00:01.000Z',
            },
          ],
        },
      }),
    });
    const api = await loadClient();

    const logs = await api.getBatchActivity('batch-1');

    expect(calls).toEqual([
      { body: undefined, method: 'GET', path: '/job-batches/batch-1/activity' },
    ]);
    expect(logs).toEqual([
      { at: '2026-10-01T10:00:00.000Z', level: 'info', message: 'Batch created' },
      {
        at: '2026-10-01T10:00:01.000Z',
        level: 'info',
        message: 'Task 2 · webhook: Attempt 1 started',
      },
    ]);
  });

  it('reports an unknown batch through the API error code', async () => {
    stubApi({
      'GET /job-batches/missing/activity': () => ({
        error: { code: 'JobBatchNotFoundError', message: 'Batch not found.' },
        status: 404,
      }),
    });
    const api = await loadClient();

    await expect(api.getBatchActivity('missing')).rejects.toMatchObject({
      code: 'JobBatchNotFoundError',
    });
  });
});
