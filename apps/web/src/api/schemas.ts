import { z } from 'zod';

// Response shapes of the backend REST API (`/api`). The client parses every response with these
// schemas, so a contract drift fails loudly at the boundary instead of deep inside a component.

const timestamp = z.iso.datetime({ offset: true });

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    details: z.object({ existingJobId: z.string().optional() }).optional(),
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

export const apiStatsSchema = z.object({
  counts: z.record(statusSchema, z.number().int()),
  healthy: z.boolean(),
});

export const apiCancelledJobSchema = z.object({ id: z.string(), status: z.literal('cancelled') });

export const apiCreatedJobSchema = z.object({ id: z.string(), startAt: timestamp });

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
