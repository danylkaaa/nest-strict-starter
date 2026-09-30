import { COARSE_STATUS } from '@/features/jobs/job-rules';

import type {
  ApiActivity,
  ApiBatchActivityEntry,
  ApiBatchChild,
  ApiBatchSummary,
  ApiJob,
  ApiTransitReport,
  Queue,
} from './schemas';
import type {
  Aircraft,
  Airport,
  BatchItemStatus,
  BatchStatus,
  Job,
  JobAttempt,
  JobLog,
  JobStatus,
  JobType,
  PathPoint,
  TaskSpec,
  TransitReport,
} from '@/features/jobs/job';

// Translates API responses into the UI's job contract (`features/jobs/job.ts`). Pure functions so
// the translation is unit-tested without a server.

export const QUEUE_BY_JOB_TYPE: Record<Exclude<JobType, 'batch'>, Queue> = {
  email: 'email',
  transit: 'aircraft-report',
  webhook: 'webhook',
};

const ERROR_MESSAGE: Record<string, string> = {
  delivery_failed: 'Delivery failed',
  delivery_or_storage: 'Delivery or storage error',
  invalid_payload: 'Invalid payload',
  worker_interrupted: 'Worker was interrupted',
};

const OUTCOME_BY_CATEGORY: Record<string, number> = {
  delivery_failed: 503,
  invalid_payload: 400,
};

const describeError = (category: string): string => ERROR_MESSAGE[category] ?? 'Unexpected error';

const KM_PER_NAUTICAL_MILE = 1.852;
const METERS_PER_FOOT = 0.3048;

export const toAirport = (airport: {
  city: string;
  iata: string;
  latitude: number;
  longitude: number;
  name: string;
}): Airport => ({
  city: airport.city,
  code: airport.iata,
  lat: airport.latitude,
  lon: airport.longitude,
  name: airport.name,
});

const toAircraft = (aircraft: ApiTransitReport['aircraft']): Aircraft => ({
  callsign: aircraft.registration,
  cruiseAltitudeFt: Math.round(aircraft.cruiseAltitudeM / METERS_PER_FOOT),
  cruiseSpeedKt: Math.round(aircraft.cruiseSpeedKmh / KM_PER_NAUTICAL_MILE),
  model: aircraft.model,
  registration: aircraft.registration,
});

export const toTransitReport = (report: ApiTransitReport): TransitReport => {
  const last = report.waypoints.length - 1;
  const path: PathPoint[] = report.waypoints.map((point, index) => ({
    fraction: last <= 0 ? 0 : index / last,
    lat: point.latitude,
    lon: point.longitude,
  }));
  return {
    aircraft: toAircraft(report.aircraft),
    arrivalAt: report.arrivalAt,
    departureAt: report.departureAt,
    destination: toAirport(report.destination),
    distanceKm: report.distanceKm,
    // The API returns fractional minutes; the UI shows whole ones
    durationMinutes: Math.round(report.durationMinutes),
    origin: toAirport(report.origin),
    path,
  };
};

const describeEvent = (
  event: Pick<ApiActivity, 'attempt' | 'errorCategory' | 'event'>,
): Pick<JobLog, 'level' | 'message'> => {
  const attempt = event.attempt ?? 1;
  const category = describeError(event.errorCategory ?? '');
  if (event.event === 'created') return { level: 'info', message: 'Job created' };
  if (event.event === 'started') return { level: 'info', message: `Attempt ${attempt} started` };
  if (event.event === 'attempt_failed')
    return { level: 'warning', message: `Attempt ${attempt} failed: ${category}` };
  if (event.event === 'retried') return { level: 'info', message: 'Retry requested' };
  if (event.event === 'cancelled') return { level: 'info', message: 'Job cancelled' };
  if (event.event === 'completed')
    return { level: 'info', message: `Completed on attempt ${attempt}` };
  return { level: 'error', message: `Gave up after attempt ${attempt}: ${category}` };
};

const toLog = (event: ApiActivity): JobLog => ({
  at: event.recordedAt,
  ...describeEvent(event),
});

const toLogs = (activity: readonly ApiActivity[]): JobLog[] =>
  activity.map((event) => toLog(event));

const JOB_TYPE_BY_QUEUE: Record<Queue, Exclude<JobType, 'batch'>> = {
  'aircraft-report': 'transit',
  'email': 'email',
  'webhook': 'webhook',
};

const toBatchLog = (entry: ApiBatchActivityEntry): JobLog => {
  const { attempt, errorCategory, event, position, queue, recordedAt: at } = entry;
  if (event === 'batch_created') return { at, level: 'info', message: 'Batch created' };
  if (event === 'cancellation_requested')
    return { at, level: 'info', message: 'Cancellation requested' };
  const { level, message } = describeEvent({ attempt, errorCategory, event });
  const task =
    position === null || queue === null ? 'Task' : `Task ${position} · ${JOB_TYPE_BY_QUEUE[queue]}`;
  return { at, level, message: `${task}: ${message}` };
};

/** The batch feed is already time-ordered by the API; one log line per entry. */
export const toBatchLogs = (entries: readonly ApiBatchActivityEntry[]): JobLog[] =>
  entries.map((entry) => toBatchLog(entry));

export const toAttempts = (activity: readonly ApiActivity[]): JobAttempt[] => {
  const attempts = new Map<number, JobAttempt>();
  const gaveUp = new Set(
    activity.flatMap((event) =>
      event.event === 'failed' && event.attempt !== null ? [event.attempt] : [],
    ),
  );
  for (const event of activity) {
    if (event.attempt === null) continue;
    const current = attempts.get(event.attempt) ?? {
      finishedAt: null,
      next: null,
      number: event.attempt,
      outcome: null,
      startedAt: event.recordedAt,
    };
    if (event.event === 'started') current.startedAt = event.recordedAt;
    if (event.event === 'completed') {
      current.finishedAt = event.recordedAt;
      current.outcome = 200;
    }
    if (event.event === 'attempt_failed') {
      current.finishedAt = event.recordedAt;
      current.outcome = OUTCOME_BY_CATEGORY[event.errorCategory ?? ''] ?? 500;
      current.next = gaveUp.has(event.attempt) ? 'gave up' : 'retry scheduled';
    }
    attempts.set(event.attempt, current);
  }
  return [...attempts.values()].toSorted((a, b) => a.number - b.number);
};

/** The API accepts any JSON as a webhook body; the UI shows an object, so wrap anything else */
export const toWebhookBody = (payload: unknown): Record<string, unknown> =>
  typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? { ...payload }
    : { value: payload };

const INSTANT_TOLERANCE_MS = 1000;

/** Anything scheduled later than creation counts as a scheduled run; instant jobs have no runAt */
const toRunAt = (job: ApiJob): string | null =>
  Date.parse(job.startAt) - Date.parse(job.createdAt) > INSTANT_TOLERANCE_MS ? job.startAt : null;

type AirportsByIcao = ReadonlyMap<string, Airport>;

const toEmailPayload = (payload: { body: string; recipient: string; subject: string }) => ({
  body: payload.body,
  subject: payload.subject,
  to: payload.recipient,
});

const toTransitPayload = (
  payload: { departureAt: string; destinationIcao: string; originIcao: string },
  airports: AirportsByIcao,
) => ({
  departureAt: payload.departureAt,
  destination: airports.get(payload.destinationIcao.toUpperCase())?.code ?? payload.destinationIcao,
  origin: airports.get(payload.originIcao.toUpperCase())?.code ?? payload.originIcao,
});

/** The submit-form task an API job or batch child stands for, to show its payload read-only */
export const toTaskSpec = (job: ApiBatchChild | ApiJob, airports: AirportsByIcao): TaskSpec => {
  if (job.queue === 'email') return { payload: toEmailPayload(job.payload), type: 'email' };
  if (job.queue === 'webhook') {
    return {
      payload: {
        body: toWebhookBody(job.payload.payload),
        method: job.payload.method,
        url: job.payload.url,
      },
      type: 'webhook',
    };
  }
  return { payload: toTransitPayload(job.payload, airports), type: 'transit' };
};

export interface JobContext {
  activity?: readonly ApiActivity[];
  /** ICAO code to airport, to show transit routes with the IATA codes the UI uses */
  airports: AirportsByIcao;
  report?: TransitReport | null;
}

export const toUiJob = (
  job: ApiJob,
  { activity = [], airports, report = null }: JobContext,
): Job => {
  const base = {
    attemptHistory: toAttempts(activity),
    attempts: job.attempts,
    batchId: job.batchId,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    error:
      job.status === 'failed' && job.lastErrorCategory !== null
        ? describeError(job.lastErrorCategory)
        : null,
    id: job.id,
    idempotencyKey: job.idempotencyKey,
    logs: toLogs(activity),
    maxAttempts: job.maxAttempts,
    priority: job.priority,
    progress: job.status === 'completed' ? 100 : 0,
    runAt: toRunAt(job),
    startedAt: activity.find((event) => event.event === 'started')?.recordedAt ?? null,
    status: job.status,
    workerId: null,
  };
  if (job.queue === 'email') {
    return {
      ...base,
      payload: toEmailPayload(job.payload),
      result: job.result === null ? null : { messageId: job.result.emailId },
      type: 'email',
    };
  }
  if (job.queue === 'webhook') {
    return {
      ...base,
      payload: {
        body: toWebhookBody(job.payload.payload),
        method: job.payload.method,
        url: job.payload.url,
      },
      // The mock receiver answers 200 on success; the API stores only the call reference
      result: job.result === null ? null : { statusCode: 200 },
      type: 'webhook',
    };
  }
  return {
    ...base,
    payload: toTransitPayload(job.payload, airports),
    result: report,
    type: 'transit',
  };
};

const BATCH_ITEM_STATUS: Record<JobStatus, BatchItemStatus> = {
  cancelled: 'cancelled',
  completed: 'done',
  failed: 'failed',
  pending: 'queued',
  processing: 'running',
  scheduled: 'queued',
};

const FINISHED_BATCH_STATUSES = new Set<BatchStatus>([
  'cancelled',
  'completed',
  'completed_with_errors',
]);

export interface BatchContext {
  /** Needed only to show the children's transit routes */
  airports?: AirportsByIcao;
  /** The batch's children in submission order; a list row has none */
  children?: readonly ApiBatchChild[];
}

/** The newest completion time among the children, once all are finished */
const latestCompletion = (children: readonly ApiBatchChild[]): string | null =>
  children
    .map((child) => child.completedAt)
    .filter((at) => at !== null)
    .toSorted()
    .at(-1) ?? null;

export const toUiBatch = (
  batch: ApiBatchSummary,
  { airports = new Map(), children = [] }: BatchContext,
): Job => {
  const finished = FINISHED_BATCH_STATUSES.has(batch.status);
  const counts = (status: JobStatus) => batch.counts[status] ?? 0;
  return {
    attemptHistory: [],
    attempts: 0,
    batchChildIds: children.map((child) => child.id),
    batchId: null,
    batchItems: children.map((child) => BATCH_ITEM_STATUS[child.status]),
    batchStatus: batch.status,
    completedAt: finished ? latestCompletion(children) : null,
    createdAt: batch.createdAt,
    error: null,
    id: batch.id,
    idempotencyKey: batch.idempotencyKey,
    logs: [],
    maxAttempts: batch.maxAttempts,
    payload: { items: children.map((child) => toTaskSpec(child, airports)) },
    priority: batch.priority,
    progress: batch.progress,
    result: finished
      ? {
          cancelled: counts('cancelled'),
          failed: counts('failed'),
          processed: counts('completed') + counts('failed') + counts('cancelled'),
          succeeded: counts('completed'),
        }
      : null,
    runAt:
      Date.parse(batch.startAt) - Date.parse(batch.createdAt) > INSTANT_TOLERANCE_MS
        ? batch.startAt
        : null,
    startedAt: null,
    status: COARSE_STATUS[batch.status],
    type: 'batch',
    workerId: null,
  };
};
