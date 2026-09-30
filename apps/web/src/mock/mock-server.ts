import { ApiError } from '@/shared/api-error';

import { AIRCRAFT, findAirport } from './airports';
import { distanceKm, greatCirclePath } from './geo';
import { paginate } from './paginate';
import { between, pick, randomId } from './random';

import type { Random } from './random';
import type {
  BatchItemStatus,
  Job,
  JobStatus,
  ListEmailsQuery,
  ListJobsQuery,
  LogLevel,
  Page,
  QueueHealth,
  SentEmail,
  SubmitJobInput,
  SubmitJobResponse,
  TaskSpec,
  TransitPayload,
  TransitReport,
} from '@/features/jobs/job';

// In-browser stand-in for the API + worker processes until the backend exists.
// State is mutable on purpose: this is the simulated infrastructure, not UI code.

const DEFAULT_MAX_ATTEMPTS = 3;
const WEBHOOK_FAILURE_RATE = 0.2;
const BATCH_CONCURRENCY = 3;
const MAX_BATCH_ITEMS = 100;
const BOUNCE_DOMAIN = '@bounce.test';
// Demo hook: a webhook URL ending in /503 always fails, so retries can be shown on demand
const FAILING_WEBHOOK_SUFFIX = '/503';
const CRUISE_KMH = 850;
const TAXI_AND_CLIMB_MINUTES = 30;
const PATH_SEGMENTS = 32;

/** Exponential backoff: 5s, 15s, 45s, ... */
export const backoffMs = (attempt: number): number => 5000 * 3 ** (attempt - 1);

const DURATION_MS: Record<Exclude<Job['type'], 'batch'>, [number, number]> = {
  email: [1000, 3000],
  transit: [2000, 4000],
  webhook: [1000, 2000],
};

interface Outcome {
  code: number;
  error?: string;
  result?: unknown;
}

/** Returns a validation message, or null when the task is valid */
const taskProblem = (task: TaskSpec): string | null => {
  if (task.type !== 'transit') return null;
  const { destination, origin } = task.payload;
  if (findAirport(origin) === undefined || findAirport(destination) === undefined) {
    return 'Unknown airport code';
  }
  return origin === destination ? 'Origin and destination must differ' : null;
};

const validate = (input: SubmitJobInput) => {
  if (input.type !== 'batch') {
    const problem = taskProblem(input);
    if (problem !== null) throw new ApiError('VALIDATION_FAILED', problem);
    return;
  }
  const { items } = input.payload;
  if (items.length === 0 || items.length > MAX_BATCH_ITEMS) {
    throw new ApiError('VALIDATION_FAILED', `Batch needs 1 to ${MAX_BATCH_ITEMS} tasks`);
  }
  items.forEach((task, index) => {
    const problem = taskProblem(task);
    if (problem !== null) throw new ApiError('VALIDATION_FAILED', `Task ${index + 1}: ${problem}`);
  });
};

type JobBase = Omit<Job, 'batchItems' | 'payload' | 'result' | 'type'>;

const withSpec = (base: JobBase, input: SubmitJobInput): Job => {
  if (input.type === 'batch') {
    return {
      ...base,
      batchItems: input.payload.items.map(() => 'queued' as const),
      payload: input.payload,
      result: null,
      type: 'batch',
    };
  }
  if (input.type === 'email')
    return { ...base, payload: input.payload, result: null, type: 'email' };
  if (input.type === 'webhook') {
    return { ...base, payload: input.payload, result: null, type: 'webhook' };
  }
  return { ...base, payload: input.payload, result: null, type: 'transit' };
};

export interface MockServerOptions {
  now: () => number;
  random: Random;
  workers: number;
}

export type MockServer = ReturnType<typeof createMockServer>;

export const createMockServer = ({ now, random, workers }: MockServerOptions) => {
  const jobs = new Map<string, Job>();
  const finishAt = new Map<string, number>();
  const iso = () => new Date(now()).toISOString();
  let created = 0;
  // Multiplicative hash of a counter: unique, but looks random like a real id
  const nextJobId = () => {
    created += 1;
    const hash = (Math.imul(created, 2_654_435_761) >>> 0).toString(36).padStart(7, '0');
    return `job_${randomId(random, '', 1)}${hash}`;
  };

  const log = (job: Job, level: LogLevel, message: string) => {
    job.logs.push({ at: iso(), level, message });
  };

  const findJob = (id: string): Job => {
    const job = jobs.get(id);
    if (job === undefined) throw new ApiError('NOT_FOUND', `Job ${id} not found`);
    return job;
  };

  const submitJob = (input: SubmitJobInput): SubmitJobResponse => {
    if (input.idempotencyKey !== undefined && input.idempotencyKey !== '') {
      const existing = [...jobs.values()].find(
        (job) => job.idempotencyKey === input.idempotencyKey,
      );
      if (existing !== undefined) return { created: false, job: existing };
    }
    validate(input);
    const scheduled = input.runAt !== undefined && Date.parse(input.runAt) > now();
    const base = {
      attemptHistory: [],
      attempts: 0,
      completedAt: null,
      createdAt: iso(),
      error: null,
      id: nextJobId(),
      idempotencyKey: input.idempotencyKey === '' ? null : (input.idempotencyKey ?? null),
      logs: [],
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      priority: input.priority ?? 0,
      progress: 0,
      runAt: scheduled ? input.runAt! : null,
      startedAt: null,
      status: scheduled ? ('scheduled' as const) : ('pending' as const),
      workerId: null,
    };
    const job = withSpec(base, input);
    log(job, 'info', 'Job created');
    if (scheduled) log(job, 'info', 'Scheduled for later execution');
    jobs.set(job.id, job);
    return { created: true, job };
  };

  const transitReport = (payload: TransitPayload): TransitReport => {
    const origin = findAirport(payload.origin)!;
    const destination = findAirport(payload.destination)!;
    const distance = distanceKm(origin, destination);
    const durationMinutes = Math.round((distance / CRUISE_KMH) * 60 + TAXI_AND_CLIMB_MINUTES);
    const departure = Date.parse(`${payload.date}T09:00:00Z`);
    return {
      aircraft: pick(random, AIRCRAFT),
      arrivalAt: new Date(departure + durationMinutes * 60_000).toISOString(),
      departureAt: new Date(departure).toISOString(),
      destination,
      distanceKm: distance,
      durationMinutes,
      origin,
      path: greatCirclePath(origin, destination, PATH_SEGMENTS),
    };
  };

  // Runs one task: a standalone job, or one item of a batch
  const runHandler = (task: TaskSpec): Outcome => {
    if (task.type === 'email') {
      return task.payload.to.endsWith(BOUNCE_DOMAIN)
        ? { code: 550, error: 'SMTP 550: mailbox unavailable' }
        : { code: 250, result: { messageId: randomId(random, 'msg_', 9) } };
    }
    if (task.type === 'webhook') {
      return task.payload.url.endsWith(FAILING_WEBHOOK_SUFFIX) || random() < WEBHOOK_FAILURE_RATE
        ? { code: 503, error: 'Webhook returned 503 Service Unavailable' }
        : { code: 200, result: { statusCode: 200 } };
    }
    return { code: 200, result: transitReport(task.payload) };
  };

  const closeAttempt = (job: Job, outcome: number | null, next: string | null) => {
    const attempt = job.attemptHistory.at(-1);
    if (attempt === undefined || attempt.finishedAt !== null) return;
    attempt.finishedAt = iso();
    attempt.outcome = outcome;
    attempt.next = next;
  };

  const complete = (job: Job, result: unknown) => {
    closeAttempt(job, 200, null);
    job.status = 'completed';
    // The handler produced the result for this job's own type
    Object.assign(job, { result });
    job.progress = 100;
    job.completedAt = iso();
    job.workerId = null;
    finishAt.delete(job.id);
    log(job, 'info', 'Job completed');
  };

  const fail = (job: Job, code: number, error: string) => {
    const attempt = job.attemptHistory.at(-1)!;
    attempt.finishedAt = iso();
    attempt.outcome = code;
    job.workerId = null;
    finishAt.delete(job.id);
    if (job.attempts < job.maxAttempts) {
      const delay = backoffMs(job.attempts);
      attempt.next = `retry in ${delay / 1000}s`;
      job.status = 'scheduled';
      job.runAt = new Date(now() + delay).toISOString();
      log(job, 'warning', `Attempt ${job.attempts} failed: ${code}. Retry in ${delay / 1000}s`);
      return;
    }
    attempt.next = 'gave up';
    job.status = 'failed';
    job.error = `${error} after ${job.attempts} attempts`;
    job.completedAt = iso();
    log(job, 'error', `Attempt ${job.attempts} failed: ${code}. Max attempts reached`);
    log(job, 'info', 'Job marked failed');
  };

  const batchSummary = (job: Extract<Job, { type: 'batch' }>) => {
    const count = (status: BatchItemStatus) =>
      job.batchItems.filter((item) => item === status).length;
    return {
      durationMs: now() - Date.parse(job.startedAt!),
      failed: count('failed'),
      processed: count('done') + count('failed'),
      succeeded: count('done'),
    };
  };

  const advanceBatch = (job: Extract<Job, { type: 'batch' }>) => {
    const total = job.batchItems.length;
    const before = job.batchItems.filter((item) => item === 'done' || item === 'failed').length;
    job.batchItems = job.batchItems.map((item, index) => {
      if (item !== 'running') return item;
      const task = job.payload.items[index]!;
      const outcome = runHandler(task);
      if (outcome.error === undefined) return 'done';
      log(job, 'warning', `Task ${index + 1} (${task.type}) failed: ${outcome.error}`);
      return 'failed';
    });
    let started = 0;
    job.batchItems = job.batchItems.map((item) => {
      if (item !== 'queued' || started >= BATCH_CONCURRENCY) return item;
      started += 1;
      return 'running';
    });
    const handled = job.batchItems.filter((item) => item === 'done' || item === 'failed').length;
    job.progress = Math.round((handled / total) * 100);
    const quarter = Math.ceil(total / 4);
    if (Math.floor(handled / quarter) > Math.floor(before / quarter) && handled < total) {
      log(job, 'info', `Processed ${handled}/${total} items`);
    }
    if (handled === total) complete(job, batchSummary(job));
  };

  const busyWorkers = () =>
    new Set([...jobs.values()].map((job) => job.workerId).filter((id) => id !== null));

  const pickUp = (job: Job) => {
    const busy = busyWorkers();
    const workerId = Array.from({ length: workers }, (_, index) => `worker-${index + 1}`).find(
      (id) => !busy.has(id),
    )!;
    job.status = 'processing';
    job.attempts += 1;
    job.startedAt = iso();
    job.runAt = null;
    job.workerId = workerId;
    job.attemptHistory.push({
      finishedAt: null,
      next: null,
      number: job.attempts,
      outcome: null,
      startedAt: iso(),
    });
    log(job, 'info', `Picked up by ${workerId} (attempt ${job.attempts} of ${job.maxAttempts})`);
    if (job.type === 'batch') {
      advanceBatch(job);
      return;
    }
    const [min, max] = DURATION_MS[job.type];
    finishAt.set(job.id, now() + between(random, min, max));
  };

  const tick = () => {
    const all = [...jobs.values()];
    for (const job of all) {
      if (job.status === 'scheduled' && Date.parse(job.runAt!) <= now()) {
        job.status = 'pending';
        job.runAt = null;
      }
    }
    for (const job of all) {
      if (job.status !== 'processing') continue;
      if (job.type === 'batch') {
        advanceBatch(job);
        continue;
      }
      if ((finishAt.get(job.id) ?? Infinity) > now()) continue;
      const outcome = runHandler(job);
      if (outcome.error === undefined) {
        closeAttempt(job, outcome.code, null);
        complete(job, outcome.result);
      } else {
        fail(job, outcome.code, outcome.error);
      }
    }
    const queue = all
      .filter((job) => job.status === 'pending')
      .toSorted(
        (a, b) => b.priority - a.priority || Date.parse(a.createdAt) - Date.parse(b.createdAt),
      );
    const free = workers - busyWorkers().size;
    for (const job of queue.slice(0, Math.max(0, free))) pickUp(job);
  };

  const cancelJob = (id: string): Job => {
    const job = findJob(id);
    const cancellable =
      job.status === 'scheduled' ||
      job.status === 'pending' ||
      (job.status === 'processing' && job.type === 'batch');
    if (!cancellable) {
      throw new ApiError('INVALID_STATE', `Cannot cancel a ${job.status} job`);
    }
    if (job.type === 'batch' && job.status === 'processing') {
      job.batchItems = job.batchItems.map((item) => (item === 'running' ? 'done' : item));
      job.result = batchSummary(job);
      closeAttempt(job, null, 'cancelled');
    }
    job.status = 'cancelled';
    job.workerId = null;
    job.completedAt = iso();
    log(job, 'info', 'Job cancelled');
    return job;
  };

  const retryJob = (id: string): Job => {
    const job = findJob(id);
    if (job.status !== 'failed') {
      throw new ApiError(
        'INVALID_STATE',
        `Only failed jobs can be retried, this one is ${job.status}`,
      );
    }
    job.status = 'pending';
    job.attempts = 0;
    job.error = null;
    job.completedAt = null;
    job.progress = 0;
    if (job.type === 'batch') job.batchItems = job.batchItems.map(() => 'queued');
    log(job, 'info', 'Manual retry requested');
    return job;
  };

  const listJobs = ({ search, status, type, ...page }: ListJobsQuery): Page<Job> => {
    const needle = search?.trim().toLowerCase() ?? '';
    const matches = [...jobs.values()]
      .filter(
        (job) =>
          (status === undefined || job.status === status) &&
          (type === undefined || job.type === type) &&
          (needle === '' ||
            job.id.includes(needle) ||
            (job.idempotencyKey?.toLowerCase().includes(needle) ?? false)),
      )
      .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return paginate(matches, page);
  };

  const getHealth = (): QueueHealth => {
    const counts: Record<JobStatus, number> = {
      cancelled: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      scheduled: 0,
    };
    for (const job of jobs.values()) counts[job.status] += 1;
    return { counts, healthy: true, workers: { busy: busyWorkers().size, total: workers } };
  };

  const listEmails = ({ search, status, ...page }: ListEmailsQuery): Page<SentEmail> => {
    const needle = search?.trim().toLowerCase() ?? '';
    const emails = [...jobs.values()]
      .filter((job) => job.type === 'email')
      .filter((job) => job.status === 'completed' || job.status === 'failed')
      .map((job): SentEmail => ({
        body: job.payload.body,
        jobId: job.id,
        maxAttempts: job.maxAttempts,
        messageId: job.result?.messageId ?? null,
        sentAt: job.completedAt!,
        status: job.status === 'completed' ? 'sent' : 'failed',
        subject: job.payload.subject,
        to: job.payload.to,
        tries: job.attempts,
      }))
      .filter(
        (email) =>
          (status === undefined || email.status === status) &&
          `${email.to} ${email.subject}`.toLowerCase().includes(needle),
      )
      .toSorted((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
    return paginate(emails, page);
  };

  return { cancelJob, getHealth, getJob: findJob, listEmails, listJobs, retryJob, submitJob, tick };
};
