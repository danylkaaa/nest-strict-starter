import { z } from 'zod';

// Response shapes of the backend REST API (`/api`). The client parses every response with these
// schemas, so a contract drift fails loudly at the boundary instead of deep inside a component.

const timestamp = z.iso.datetime({ offset: true });

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    details: z
      .object({ existingBatchId: z.string().optional(), existingJobId: z.string().optional() })
      .optional(),
    message: z.string(),
  }),
  ok: z.literal(false),
});

export const QUEUES = ['email', 'webhook', 'aircraft-report'] as const;
export type Queue = (typeof QUEUES)[number];

const statusSchema = z.enum([
  'scheduled',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

const jobBase = z.object({
  attempts: z.number().int(),
  batchId: z.string().nullable(),
  completedAt: timestamp.nullable(),
  createdAt: timestamp,
  id: z.string(),
  idempotencyKey: z.string(),
  lastErrorCategory: z.string().nullable(),
  maxAttempts: z.number().int(),
  priority: z.number().int(),
  startAt: timestamp,
  status: statusSchema,
});

const emailPayload = z.object({ body: z.string(), recipient: z.string(), subject: z.string() });
const webhookPayload = z.object({
  method: z.enum(['POST', 'PUT']),
  payload: z.json(),
  url: z.string(),
});
const transitPayload = z.object({
  aircraftId: z.string(),
  departureAt: timestamp,
  destinationIcao: z.string(),
  originIcao: z.string(),
});

export const apiJobSchema = z.discriminatedUnion('queue', [
  jobBase.extend({
    payload: emailPayload,
    queue: z.literal('email'),
    result: z.object({ emailId: z.string() }).nullable(),
  }),
  jobBase.extend({
    payload: webhookPayload,
    queue: z.literal('webhook'),
    result: z.object({ webhookCallId: z.string() }).nullable(),
  }),
  jobBase.extend({
    payload: transitPayload,
    queue: z.literal('aircraft-report'),
    result: z.object({ reportId: z.string() }).nullable(),
  }),
]);
export type ApiJob = z.infer<typeof apiJobSchema>;

export const activitySchema = z.object({
  attempt: z.number().int().nullable(),
  errorCategory: z.string().nullable(),
  event: z.enum([
    'created',
    'started',
    'attempt_failed',
    'cancelled',
    'completed',
    'failed',
    'retried',
  ]),
  id: z.string(),
  recordedAt: timestamp,
});
export type ApiActivity = z.infer<typeof activitySchema>;

export const apiJobDetailSchema = z.intersection(
  apiJobSchema,
  z.object({ activity: z.array(activitySchema) }),
);
export type ApiJobDetail = z.infer<typeof apiJobDetailSchema>;

export const apiJobPageSchema = z.object({
  items: z.array(apiJobSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const apiHealthSchema = z.object({
  checks: z.object({ database: z.enum(['up', 'down']), queue: z.enum(['up', 'down']) }),
  counts: z.record(statusSchema, z.number().int()),
  status: z.enum(['ok', 'down']),
});

export const apiCancelledJobSchema = z.object({ id: z.string(), status: z.literal('cancelled') });

export const apiCreatedJobSchema = z.object({ id: z.string(), startAt: timestamp });
export const apiCreatedBatchSchema = apiCreatedJobSchema;

export const apiAirportsSchema = z.object({
  items: z.array(
    z.object({
      city: z.string(),
      iata: z.string(),
      icao: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      name: z.string(),
    }),
  ),
});

export const apiAircraftListSchema = z.object({
  items: z.array(
    z.object({
      cruiseAltitudeM: z.number(),
      cruiseSpeedKmh: z.number(),
      id: z.string(),
      model: z.string(),
      registration: z.string(),
    }),
  ),
});

const airportRef = z.object({
  city: z.string(),
  iata: z.string(),
  icao: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string(),
});

export const apiTransitReportSchema = z.object({
  aircraft: z.object({
    cruiseAltitudeM: z.number(),
    cruiseSpeedKmh: z.number(),
    id: z.string(),
    model: z.string(),
    registration: z.string(),
  }),
  arrivalAt: timestamp,
  departureAt: timestamp,
  destination: airportRef,
  distanceKm: z.number(),
  durationMinutes: z.number(),
  origin: airportRef,
  waypoints: z.array(
    z.object({
      altitudeM: z.number(),
      latitude: z.number(),
      longitude: z.number(),
      speedKmh: z.number(),
      timestamp,
    }),
  ),
});
export type ApiTransitReport = z.infer<typeof apiTransitReportSchema>;

// --- job batches -------------------------------------------------------------------------------

export const apiBatchStatusSchema = z.enum([
  'scheduled',
  'pending',
  'processing',
  'cancelling',
  'cancelled',
  'completed',
  'completed_with_errors',
]);
export type ApiBatchStatus = z.infer<typeof apiBatchStatusSchema>;

const batchSummaryShape = {
  cancellationRequestedAt: timestamp.nullable(),
  counts: z.record(statusSchema, z.number().int()),
  createdAt: timestamp,
  id: z.string(),
  idempotencyKey: z.string(),
  maxAttempts: z.number().int(),
  priority: z.number().int(),
  progress: z.number().int(),
  startAt: timestamp,
  status: apiBatchStatusSchema,
  total: z.number().int(),
};

export const apiBatchSummarySchema = z.object(batchSummaryShape);
export type ApiBatchSummary = z.infer<typeof apiBatchSummarySchema>;

const batchChildBase = z.object({
  attempts: z.number().int(),
  completedAt: timestamp.nullable(),
  id: z.string(),
  lastErrorCategory: z.string().nullable(),
  link: z.string(),
  position: z.number().int(),
  status: statusSchema,
});

export const apiBatchChildSchema = z.discriminatedUnion('queue', [
  batchChildBase.extend({
    payload: emailPayload,
    queue: z.literal('email'),
    result: z.object({ emailId: z.string() }).nullable(),
  }),
  batchChildBase.extend({
    payload: webhookPayload,
    queue: z.literal('webhook'),
    result: z.object({ webhookCallId: z.string() }).nullable(),
  }),
  batchChildBase.extend({
    payload: transitPayload,
    queue: z.literal('aircraft-report'),
    result: z.object({ reportId: z.string() }).nullable(),
  }),
]);
export type ApiBatchChild = z.infer<typeof apiBatchChildSchema>;

export const apiBatchSchema = z.object({
  ...batchSummaryShape,
  items: z.array(apiBatchChildSchema),
});
export type ApiBatch = z.infer<typeof apiBatchSchema>;

export const apiBatchPageSchema = z.object({
  items: z.array(apiBatchSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
