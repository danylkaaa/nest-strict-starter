import type { ApiActivity, ApiJob, ApiTransitReport, Queue } from './schemas';
import type {
  Aircraft,
  Airport,
  Job,
  JobAttempt,
  JobLog,
  JobType,
  PathPoint,
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

const toLog = (event: ApiActivity): JobLog => {
  const { recordedAt: at } = event;
  const attempt = event.attempt ?? 1;
  const category = describeError(event.errorCategory ?? '');
  if (event.event === 'created') return { at, level: 'info', message: 'Job created' };
  if (event.event === 'started')
    return { at, level: 'info', message: `Attempt ${attempt} started` };
  if (event.event === 'attempt_failed')
    return { at, level: 'warning', message: `Attempt ${attempt} failed: ${category}` };
  if (event.event === 'retried') return { at, level: 'info', message: 'Retry requested' };
  if (event.event === 'cancelled') return { at, level: 'info', message: 'Job cancelled' };
  if (event.event === 'completed')
    return { at, level: 'info', message: `Completed on attempt ${attempt}` };
  return { at, level: 'error', message: `Gave up after attempt ${attempt}: ${category}` };
};

const toLogs = (activity: readonly ApiActivity[]): JobLog[] =>
  activity.map((event) => toLog(event));

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

export interface JobContext {
  activity?: readonly ApiActivity[];
  /** ICAO code to airport, to show transit routes with the IATA codes the UI uses */
  airports: ReadonlyMap<string, Airport>;
  report?: TransitReport | null;
}

export const toUiJob = (
  job: ApiJob,
  { activity = [], airports, report = null }: JobContext,
): Job => {
  const base = {
    attemptHistory: toAttempts(activity),
    attempts: job.attempts,
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
      payload: { body: job.payload.body, subject: job.payload.subject, to: job.payload.recipient },
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
  const { departureAt, destinationIcao, originIcao } = job.payload;
  return {
    ...base,
    payload: {
      departureAt,
      destination: airports.get(destinationIcao.toUpperCase())?.code ?? destinationIcao,
      origin: airports.get(originIcao.toUpperCase())?.code ?? originIcao,
    },
    result: report,
    type: 'transit',
  };
};
