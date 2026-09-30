import { JOB_STATUSES } from '@/features/jobs/job';
import { COARSE_STATUS } from '@/features/jobs/job-rules';
import { ApiError } from '@/shared/api-error';

import { request } from './http';
import {
  QUEUE_BY_JOB_TYPE,
  toAirport,
  toBatchLogs,
  toTransitReport,
  toUiBatch,
  toUiJob,
  toWebhookBody,
} from './mappers';
import {
  apiAircraftListSchema,
  apiAirportsSchema,
  apiBatchActivitySchema,
  apiBatchPageSchema,
  apiBatchSchema,
  apiCancelledJobSchema,
  apiCreatedBatchSchema,
  apiCreatedJobSchema,
  apiHealthSchema,
  apiJobDetailSchema,
  apiJobPageSchema,
  apiTransitReportSchema,
} from './schemas';

import type { ApiBatchSummary, ApiJob } from './schemas';
import type {
  Airport,
  Job,
  JobLog,
  JobStatus,
  ListEmailsQuery,
  ListJobsQuery,
  ListReportsQuery,
  ListWebhooksQuery,
  Page,
  QueueHealth,
  SentEmail,
  SentReport,
  SentWebhook,
  SubmitJobInput,
  SubmitJobResponse,
  TaskSpec,
} from '@/features/jobs/job';

// API client, the only entry point for server data. Jobs and job batches are served by the backend
// REST API; a batch has its own endpoints (`/job-batches`) and its own detail route.

const MAX_API_PAGE_SIZE = 100;

// --- reference data ---------------------------------------------------------------------------

interface Airports {
  byIcao: Map<string, Airport>;
  icaoByIata: Map<string, string>;
  list: Airport[];
}

let airportsRequest: Promise<Airports> | undefined;

const loadAirports = (): Promise<Airports> => {
  airportsRequest ??= request(apiAirportsSchema, '/airports').then(({ items }) => ({
    byIcao: new Map(items.map((airport) => [airport.icao, toAirport(airport)])),
    icaoByIata: new Map(items.map((airport) => [airport.iata, airport.icao])),
    list: items.map((airport) => toAirport(airport)),
  }));
  // A failed load must not be cached forever
  airportsRequest.catch(() => {
    airportsRequest = undefined;
  });
  return airportsRequest;
};

let aircraftRequest: Promise<string> | undefined;

/** The UI has no aircraft picker, so transit jobs use the first seeded aircraft */
const loadDefaultAircraftId = (): Promise<string> => {
  aircraftRequest ??= request(apiAircraftListSchema, '/aircraft').then(({ items }) => {
    const [first] = items;
    if (first === undefined) throw new ApiError('NO_AIRCRAFT', 'No aircraft are available');
    return first.id;
  });
  // A failed load must not be cached forever
  aircraftRequest.catch(() => {
    aircraftRequest = undefined;
  });
  return aircraftRequest;
};

// --- jobs -------------------------------------------------------------------------------------

const loadJob = async (id: string): Promise<Job> => {
  const [detail, airports] = await Promise.all([
    request(apiJobDetailSchema, `/jobs/${id}`),
    loadAirports(),
  ]);
  const report =
    detail.queue === 'aircraft-report' && detail.result !== null
      ? toTransitReport(
          await request(
            apiTransitReportSchema,
            `/aircraft-transit-reports/${detail.result.reportId}`,
          ),
        )
      : null;
  return toUiJob(detail, { activity: detail.activity, airports: airports.byIcao, report });
};

const apiJobQuery = (query: ListJobsQuery, page: number, pageSize: number) => ({
  page,
  pageSize,
  queue:
    query.type === undefined || query.type === 'batch' ? undefined : QUEUE_BY_JOB_TYPE[query.type],
  search: query.search,
  status: query.status,
});

/** The first `count` API jobs matching the query, newest first */
const loadApiJobPrefix = async (
  query: ListJobsQuery,
  count: number,
): Promise<{ items: ApiJob[]; total: number }> => {
  const items: ApiJob[] = [];
  let total = 0;
  for (let page = 1; items.length < count; page += 1) {
    const result = await request(apiJobPageSchema, '/jobs', {
      query: apiJobQuery(query, page, MAX_API_PAGE_SIZE),
    });
    total = result.total;
    items.push(...result.items);
    if (page >= result.totalPages) break;
  }
  return { items: items.slice(0, count), total };
};

// --- batches ----------------------------------------------------------------------------------

const loadBatch = async (id: string): Promise<Job> => {
  const [batch, airports] = await Promise.all([
    request(apiBatchSchema, `/job-batches/${id}`),
    loadAirports(),
  ]);
  return toUiBatch(batch, { airports: airports.byIcao, children: batch.items });
};

const hasBatchFilter = (query: ListJobsQuery): boolean =>
  query.status !== undefined || (query.search?.trim() ?? '') !== '';

/** The batch list has no filters, so status and search are applied here */
const matchesBatchQuery = (batch: ApiBatchSummary, query: ListJobsQuery): boolean => {
  const needle = query.search?.trim().toLowerCase() ?? '';
  return (
    (query.status === undefined || COARSE_STATUS[batch.status] === query.status) &&
    (needle === '' ||
      batch.id.toLowerCase().includes(needle) ||
      batch.idempotencyKey.toLowerCase().includes(needle))
  );
};

/**
 * The first `count` batches matching the query, newest first. With a filter the whole list is
 * read, because the matching batches are not known in advance; without one only the pages that
 * the requested window needs.
 */
const loadBatchPrefix = async (
  query: ListJobsQuery,
  count: number,
): Promise<{ items: ApiBatchSummary[]; total: number }> => {
  const filtered = hasBatchFilter(query);
  const items: ApiBatchSummary[] = [];
  let total = 0;
  // At least one page is read; later pages only while the window or the filter needs them
  for (let page = 1; ; page += 1) {
    const result = await request(apiBatchPageSchema, '/job-batches', {
      query: { page, pageSize: MAX_API_PAGE_SIZE },
    });
    items.push(...result.items.filter((batch) => matchesBatchQuery(batch, query)));
    total = result.total;
    if (page >= result.totalPages || (!filtered && items.length >= count)) break;
  }
  return { items: items.slice(0, count), total: filtered ? items.length : total };
};

const newestFirst = (a: Job, b: Job): number =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

const listJobs = async (query: ListJobsQuery): Promise<Page<Job>> => {
  const offset = (query.page - 1) * query.pageSize;
  const window = offset + query.pageSize;

  if (query.type === 'batch') {
    const batches = await loadBatchPrefix(query, window);
    return {
      items: batches.items.slice(offset, window).map((batch) => toUiBatch(batch, {})),
      page: query.page,
      pageSize: query.pageSize,
      total: batches.total,
      totalPages: Math.max(1, Math.ceil(batches.total / query.pageSize)),
    };
  }

  const airports = (await loadAirports()).byIcao;
  const toJob = (job: ApiJob) => toUiJob(job, { airports });

  if (query.type !== undefined) {
    const result = await request(apiJobPageSchema, '/jobs', {
      query: apiJobQuery(query, query.page, query.pageSize),
    });
    return { ...result, items: result.items.map(toJob) };
  }

  // No type filter: merge standalone jobs with batch parents. The API list leaves out batch
  // children, and both lists are sorted newest first, so the requested window lies inside the
  // first `offset + pageSize` items of each.
  const [api, batches] = await Promise.all([
    loadApiJobPrefix(query, window),
    loadBatchPrefix(query, window),
  ]);
  const merged = [
    ...api.items.map(toJob),
    ...batches.items.map((batch) => toUiBatch(batch, {})),
  ].toSorted(newestFirst);
  const total = api.total + batches.total;
  return {
    items: merged.slice(offset, window),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
};

/** Translates the form's payload into the body the queue's endpoint expects */
const toApiPayload = async (input: TaskSpec) => {
  if (input.type === 'email') {
    const { body, subject, to } = input.payload;
    return { body, recipient: to, subject };
  }
  if (input.type === 'webhook') {
    const { body, method, url } = input.payload;
    return { method, payload: body, url };
  }
  const { departureAt, destination, origin } = input.payload;
  const { icaoByIata } = await loadAirports();
  return {
    aircraftId: await loadDefaultAircraftId(),
    departureAt,
    destinationIcao: icaoByIata.get(destination) ?? destination,
    originIcao: icaoByIata.get(origin) ?? origin,
  };
};

/** Fields every submission shares: key, limits, and the instant or scheduled start */
const toEnvelope = (input: SubmitJobInput) => {
  const runAt = input.runAt !== undefined && Date.parse(input.runAt) > Date.now();
  return {
    idempotencyKey: input.idempotencyKey,
    maxAttempts: input.maxAttempts,
    priority: input.priority,
    ...(runAt ? { startAt: input.runAt } : {}),
    type: runAt ? 'schedule' : 'instant',
  };
};

const submitBatch = async (
  input: Extract<SubmitJobInput, { type: 'batch' }>,
): Promise<SubmitJobResponse> => {
  const items = await Promise.all(
    input.payload.items.map(async (task) => ({
      payload: await toApiPayload(task),
      type: QUEUE_BY_JOB_TYPE[task.type],
    })),
  );
  try {
    const created = await request(apiCreatedBatchSchema, '/job-batches', {
      body: { ...toEnvelope(input), items },
      method: 'POST',
    });
    return { created: true, job: await loadBatch(created.id) };
  } catch (error) {
    // A repeated batch key answers with the batch the first submit created
    if (error instanceof ApiError && error.existingBatchId !== undefined)
      return { created: false, job: await loadBatch(error.existingBatchId) };
    throw error;
  }
};

const submitJob = async (input: SubmitJobInput): Promise<SubmitJobResponse> => {
  if (input.type === 'batch') return submitBatch(input);
  const payload = await toApiPayload(input);
  try {
    const created = await request(apiCreatedJobSchema, `/jobs/${QUEUE_BY_JOB_TYPE[input.type]}`, {
      body: { ...toEnvelope(input), payload },
      method: 'POST',
    });
    return { created: true, job: await loadJob(created.id) };
  } catch (error) {
    // A repeated idempotency key answers with the job the first submit created
    if (error instanceof ApiError && error.existingJobId !== undefined)
      return { created: false, job: await loadJob(error.existingJobId) };
    throw error;
  }
};

const listEmails = async (query: ListEmailsQuery): Promise<Page<SentEmail>> => {
  const statuses: JobStatus[] =
    query.status === undefined
      ? ['completed', 'failed']
      : [query.status === 'sent' ? 'completed' : 'failed'];
  const result = await request(apiJobPageSchema, '/jobs', {
    query: {
      page: query.page,
      pageSize: query.pageSize,
      queue: 'email',
      search: query.search,
      status: statuses.join(','),
    },
  });
  const items = result.items.flatMap((job): SentEmail[] =>
    job.queue === 'email'
      ? [
          {
            body: job.payload.body,
            jobId: job.id,
            maxAttempts: job.maxAttempts,
            messageId: job.result?.emailId ?? null,
            sentAt: job.completedAt ?? job.createdAt,
            status: job.status === 'completed' ? 'sent' : 'failed',
            subject: job.payload.subject,
            to: job.payload.recipient,
            tries: job.attempts,
          },
        ]
      : [],
  );
  return { ...result, items };
};

const listReports = async (query: ListReportsQuery): Promise<Page<SentReport>> => {
  const [result, airports] = await Promise.all([
    request(apiJobPageSchema, '/jobs', {
      query: {
        page: query.page,
        pageSize: query.pageSize,
        queue: 'aircraft-report',
        search: query.search,
        status:
          query.status === undefined
            ? 'completed,failed'
            : query.status === 'generated'
              ? 'completed'
              : 'failed',
      },
    }),
    loadAirports(),
  ]);
  const iata = (icao: string) => airports.byIcao.get(icao.toUpperCase())?.code ?? icao;
  const items = result.items.flatMap((job): SentReport[] =>
    job.queue === 'aircraft-report'
      ? [
          {
            departureAt: job.payload.departureAt,
            destination: iata(job.payload.destinationIcao),
            finishedAt: job.completedAt ?? job.createdAt,
            jobId: job.id,
            maxAttempts: job.maxAttempts,
            origin: iata(job.payload.originIcao),
            status: job.status === 'completed' ? 'generated' : 'failed',
            tries: job.attempts,
          },
        ]
      : [],
  );
  return { ...result, items };
};

const listWebhooks = async (query: ListWebhooksQuery): Promise<Page<SentWebhook>> => {
  const result = await request(apiJobPageSchema, '/jobs', {
    query: {
      page: query.page,
      pageSize: query.pageSize,
      queue: 'webhook',
      search: query.search,
      status:
        query.status === undefined
          ? 'completed,failed'
          : query.status === 'delivered'
            ? 'completed'
            : 'failed',
    },
  });
  const items = result.items.flatMap((job): SentWebhook[] =>
    job.queue === 'webhook'
      ? [
          {
            body: toWebhookBody(job.payload.payload),
            jobId: job.id,
            maxAttempts: job.maxAttempts,
            method: job.payload.method,
            sentAt: job.completedAt ?? job.createdAt,
            status: job.status === 'completed' ? 'delivered' : 'failed',
            tries: job.attempts,
            url: job.payload.url,
          },
        ]
      : [],
  );
  return { ...result, items };
};

// An unreachable API or a 503 is an answer for the health card ("not healthy"), not a load error
const UNHEALTHY_CODES = new Set(['NETWORK_ERROR', 'SERVICE_UNAVAILABLE']);

const getHealth = async (): Promise<QueueHealth> => {
  try {
    const health = await request(apiHealthSchema, '/health');
    const counts = {
      cancelled: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      scheduled: 0,
    };
    for (const status of JOB_STATUSES) counts[status] = health.counts[status] ?? 0;
    return { counts, healthy: health.status === 'ok' };
  } catch (error) {
    if (error instanceof ApiError && UNHEALTHY_CODES.has(error.code))
      return {
        counts: { cancelled: 0, completed: 0, failed: 0, pending: 0, processing: 0, scheduled: 0 },
        healthy: false,
      };
    throw error;
  }
};

export const api = {
  // DELETE /api/job-batches/:id
  cancelBatch: async (id: string): Promise<Job> => {
    await request(apiBatchSchema, `/job-batches/${id}`, { method: 'DELETE' });
    return loadBatch(id);
  },
  // DELETE /api/jobs/:id
  cancelJob: async (id: string): Promise<Job> => {
    await request(apiCancelledJobSchema, `/jobs/${id}`, { method: 'DELETE' });
    return loadJob(id);
  },
  // GET /api/job-batches/:id
  getBatch: loadBatch,
  // GET /api/job-batches/:id/activity
  getBatchActivity: async (id: string): Promise<JobLog[]> =>
    toBatchLogs((await request(apiBatchActivitySchema, `/job-batches/${id}/activity`)).items),
  // GET /api/health
  getHealth,
  // GET /api/jobs/:id (+ GET /api/aircraft-transit-reports/:id for a finished transit job)
  getJob: loadJob,
  // GET /api/airports
  listAirports: async (): Promise<readonly Airport[]> => (await loadAirports()).list,
  // GET /api/jobs?queue=email&status=completed,failed&search=&page=&pageSize=
  listEmails,
  // GET /api/jobs?queue=&status=&search=&page=&pageSize= merged with GET /api/job-batches
  listJobs,
  // GET /api/jobs?queue=aircraft-report&status=completed,failed&search=&page=&pageSize=
  listReports,
  // GET /api/jobs?queue=webhook&status=completed,failed&search=&page=&pageSize=
  listWebhooks,
  // POST /api/jobs/:id/retry
  retryJob: async (id: string): Promise<Job> => {
    await request(apiJobDetailSchema, `/jobs/${id}/retry`, { method: 'POST' });
    return loadJob(id);
  },
  // POST /api/jobs/email | webhook | aircraft-report, POST /api/job-batches
  submitJob,
};
