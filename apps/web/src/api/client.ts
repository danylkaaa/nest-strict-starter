import { JOB_STATUSES } from '@/features/jobs/job';
import { mockServer } from '@/mock/runtime';
import { ApiError } from '@/shared/api-error';

import { request } from './http';
import { QUEUE_BY_JOB_TYPE, toAirport, toTransitReport, toUiJob, toWebhookBody } from './mappers';
import {
  apiAircraftListSchema,
  apiAirportsSchema,
  apiCancelledJobSchema,
  apiCreatedJobSchema,
  apiHealthSchema,
  apiJobDetailSchema,
  apiJobPageSchema,
  apiTransitReportSchema,
} from './schemas';

import type { ApiJob } from './schemas';
import type {
  Airport,
  Job,
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
} from '@/features/jobs/job';

// API client, the only entry point for server data. Email, webhook, and transit jobs are served by
// the backend REST API. Batch jobs are not built there yet, so they stay in the in-browser mock
// server (`mock/`); their IDs start with `job_`, which is how calls are routed.

const MAX_API_PAGE_SIZE = 100;
const MOCK_ALL = 1000;

const isMockJobId = (id: string): boolean => id.startsWith('job_');

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

/** The UI has no aircraft picker, so transit jobs use the first seeded aircraft */
const loadDefaultAircraftId = async (): Promise<string> => {
  const { items } = await request(apiAircraftListSchema, '/aircraft');
  const [first] = items;
  if (first === undefined) throw new ApiError('NO_AIRCRAFT', 'No aircraft are available');
  return first.id;
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

const newestFirst = (a: Job, b: Job): number =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

const listJobs = async (query: ListJobsQuery): Promise<Page<Job>> => {
  if (query.type === 'batch') return mockServer.listJobs(query);
  const airports = (await loadAirports()).byIcao;
  const toJob = (job: ApiJob) => toUiJob(job, { airports });
  const offset = (query.page - 1) * query.pageSize;

  if (query.type !== undefined) {
    const result = await request(apiJobPageSchema, '/jobs', {
      query: apiJobQuery(query, query.page, query.pageSize),
    });
    return { ...result, items: result.items.map(toJob) };
  }

  // No type filter: merge API jobs with the mocked batches. Both lists are sorted newest first,
  // so the requested window lies inside the first `offset + pageSize` items of each.
  const [api, batches] = await Promise.all([
    loadApiJobPrefix(query, offset + query.pageSize),
    Promise.resolve(mockServer.listJobs({ ...query, page: 1, pageSize: MOCK_ALL, type: 'batch' })),
  ]);
  const merged = [...api.items.map(toJob), ...batches.items].toSorted(newestFirst);
  const total = api.total + batches.total;
  return {
    items: merged.slice(offset, offset + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
};

/** Translates the form's payload into the body the queue's endpoint expects */
const toApiPayload = async (input: Exclude<SubmitJobInput, { type: 'batch' }>) => {
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

const submitJob = async (input: SubmitJobInput): Promise<SubmitJobResponse> => {
  if (input.type === 'batch') return mockServer.submitJob(input);
  const runAt = input.runAt !== undefined && Date.parse(input.runAt) > Date.now();
  const envelope = {
    idempotencyKey: input.idempotencyKey,
    maxAttempts: input.maxAttempts,
    priority: input.priority,
    ...(runAt ? { startAt: input.runAt } : {}),
    type: runAt ? 'schedule' : 'instant',
  };
  const payload = await toApiPayload(input);
  try {
    const created = await request(apiCreatedJobSchema, `/jobs/${QUEUE_BY_JOB_TYPE[input.type]}`, {
      body: { ...envelope, payload },
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
  const batches = mockServer.getHealth();
  try {
    const health = await request(apiHealthSchema, '/health');
    const counts = { ...batches.counts };
    for (const status of JOB_STATUSES) counts[status] += health.counts[status] ?? 0;
    return { counts, healthy: health.status === 'ok' && batches.healthy };
  } catch (error) {
    if (error instanceof ApiError && UNHEALTHY_CODES.has(error.code))
      return { counts: batches.counts, healthy: false };
    throw error;
  }
};

export const api = {
  // DELETE /api/jobs/:id
  cancelJob: async (id: string): Promise<Job> => {
    if (isMockJobId(id)) return mockServer.cancelJob(id);
    await request(apiCancelledJobSchema, `/jobs/${id}`, { method: 'DELETE' });
    return loadJob(id);
  },
  // GET /api/health
  getHealth,
  // GET /api/jobs/:id (+ GET /api/aircraft-transit-reports/:id for a finished transit job)
  getJob: async (id: string): Promise<Job> =>
    isMockJobId(id) ? mockServer.getJob(id) : loadJob(id),
  // GET /api/airports
  listAirports: async (): Promise<readonly Airport[]> => (await loadAirports()).list,
  // GET /api/jobs?queue=email&status=completed,failed&search=&page=&pageSize=
  listEmails,
  // GET /api/jobs?queue=&status=&search=&page=&pageSize=
  listJobs,
  // GET /api/jobs?queue=aircraft-report&status=completed,failed&search=&page=&pageSize=
  listReports,
  // GET /api/jobs?queue=webhook&status=completed,failed&search=&page=&pageSize=
  listWebhooks,
  // POST /api/jobs/:id/retry
  retryJob: async (id: string): Promise<Job> => {
    if (isMockJobId(id)) return mockServer.retryJob(id);
    await request(apiJobDetailSchema, `/jobs/${id}/retry`, { method: 'POST' });
    return loadJob(id);
  },
  // POST /api/jobs/email | webhook | aircraft-report
  submitJob,
};
