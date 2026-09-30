// Job contract shared by the UI and the API mappers. Mirrors the backend API responses.

export const JOB_TYPES = ['email', 'webhook', 'transit', 'batch'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  'scheduled',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * Status of a batch parent, derived by the backend from its children. It differs from a child's
 * job status: `completed_with_errors` and `cancelling` exist only for batches.
 */
export const BATCH_STATUSES = [
  'scheduled',
  'pending',
  'processing',
  'cancelling',
  'cancelled',
  'completed',
  'completed_with_errors',
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

/** What a status badge can show: a job status or a batch-only status */
export type DisplayStatus = BatchStatus | JobStatus;

export type LogLevel = 'error' | 'info' | 'warning';

export interface JobLog {
  at: string;
  level: LogLevel;
  message: string;
}

export interface JobAttempt {
  finishedAt: string | null;
  number: number;
  /** HTTP-like outcome code shown in the attempts card, e.g. 200 or 503 */
  outcome: number | null;
  /** Human-readable follow-up, e.g. "retry in 5s" or "gave up" */
  next: string | null;
  startedAt: string;
}

export interface EmailPayload {
  body: string;
  subject: string;
  to: string;
}

export interface WebhookPayload {
  body: Record<string, unknown>;
  method: 'POST' | 'PUT';
  url: string;
}

export interface TransitPayload {
  /** ISO timestamp (UTC) of the departure */
  departureAt: string;
  destination: string;
  origin: string;
}

/** A single unit of work: a standalone job or one task inside a batch */
export type TaskSpec =
  | { payload: EmailPayload; type: 'email' }
  | { payload: TransitPayload; type: 'transit' }
  | { payload: WebhookPayload; type: 'webhook' };

export type TaskType = TaskSpec['type'];

export const TASK_TYPES = ['email', 'webhook', 'transit'] as const satisfies readonly TaskType[];

export interface BatchPayload {
  items: TaskSpec[];
}

export interface EmailResult {
  messageId: string;
}

export interface WebhookResult {
  statusCode: number;
}

export interface Airport {
  city: string;
  code: string;
  lat: number;
  lon: number;
  name: string;
}

export interface Aircraft {
  callsign: string;
  cruiseAltitudeFt: number;
  cruiseSpeedKt: number;
  model: string;
  registration: string;
}

export interface PathPoint {
  /** Fraction of the route flown, 0 at origin and 1 at destination */
  fraction: number;
  lat: number;
  lon: number;
}

export interface TransitReport {
  aircraft: Aircraft;
  arrivalAt: string;
  departureAt: string;
  destination: Airport;
  distanceKm: number;
  durationMinutes: number;
  origin: Airport;
  path: PathPoint[];
}

/** Child outcomes of a finished batch; `processed` counts every child that reached a final state */
export interface BatchResult {
  cancelled: number;
  failed: number;
  processed: number;
  succeeded: number;
}

export type BatchItemStatus = 'cancelled' | 'done' | 'failed' | 'queued' | 'running';

interface JobBase {
  attemptHistory: JobAttempt[];
  attempts: number;
  /** Set on a child of a batch, which is managed through its batch */
  batchId: string | null;
  completedAt: string | null;
  createdAt: string;
  error: string | null;
  id: string;
  idempotencyKey: string | null;
  logs: JobLog[];
  maxAttempts: number;
  priority: number;
  progress: number;
  runAt: string | null;
  startedAt: string | null;
  status: JobStatus;
  workerId: string | null;
}

export type Job = JobBase &
  (
    | {
        /** Child job IDs in submission order, parallel to `batchItems` and `payload.items` */
        batchChildIds: string[];
        batchItems: BatchItemStatus[];
        /** Exact batch status; `status` is its coarse job-status equivalent for filters */
        batchStatus: BatchStatus;
        payload: BatchPayload;
        result: BatchResult | null;
        type: 'batch';
      }
    | { payload: EmailPayload; result: EmailResult | null; type: 'email' }
    | { payload: TransitPayload; result: TransitReport | null; type: 'transit' }
    | { payload: WebhookPayload; result: WebhookResult | null; type: 'webhook' }
  );

export type JobSpec = TaskSpec | { payload: BatchPayload; type: 'batch' };

export type SubmitJobInput = JobSpec & {
  idempotencyKey?: string;
  maxAttempts?: number;
  priority?: number;
  /** ISO timestamp; omitted or past means run now */
  runAt?: string;
};

export interface SubmitJobResponse {
  /** false when an existing job was returned for a reused idempotency key */
  created: boolean;
  job: Job;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListJobsQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: JobStatus;
  type?: JobType;
}

export interface QueueHealth {
  counts: Record<JobStatus, number>;
  healthy: boolean;
}

export type SentEmailStatus = 'failed' | 'sent';

export interface SentEmail {
  body: string;
  jobId: string;
  maxAttempts: number;
  messageId: string | null;
  sentAt: string;
  status: SentEmailStatus;
  subject: string;
  to: string;
  tries: number;
}

export interface ListEmailsQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: SentEmailStatus;
}

export type ReportStatus = 'failed' | 'generated';

export interface SentReport {
  departureAt: string;
  destination: string;
  finishedAt: string;
  jobId: string;
  maxAttempts: number;
  origin: string;
  status: ReportStatus;
  tries: number;
}

export interface ListReportsQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: ReportStatus;
}

export type SentWebhookStatus = 'delivered' | 'failed';

export interface SentWebhook {
  body: Record<string, unknown>;
  jobId: string;
  maxAttempts: number;
  method: WebhookPayload['method'];
  sentAt: string;
  status: SentWebhookStatus;
  tries: number;
  url: string;
}

export interface ListWebhooksQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: SentWebhookStatus;
}
