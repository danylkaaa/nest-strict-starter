import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { refineSchedule } from '@/api/endpoints/jobs/dtos/create-job.schema.js';
import { DEFAULT_MAX_ATTEMPTS, MAX_ATTEMPTS_LIMIT } from '@/common/queue/retry-policy.js';
import { TransitJobPayloadSchema } from '@/modules/aircraft-transits/aircraft-transit.js';
import { EmailContentSchema } from '@/modules/emails/email.js';
import { MAX_BATCH_ITEMS, MIN_BATCH_ITEMS } from '@/modules/jobs/job-batch.js';
import { WebhookContentSchema } from '@/modules/webhooks/webhook.js';

/**
 * A new child job. Strict objects and the `type` literals reject nested batches and references to
 * existing jobs.
 */
export const JobBatchItemSchema = z.discriminatedUnion('type', [
  z.strictObject({ payload: EmailContentSchema, type: z.literal('email') }),
  z.strictObject({ payload: WebhookContentSchema, type: z.literal('webhook') }),
  z.strictObject({ payload: TransitJobPayloadSchema, type: z.literal('aircraft-report') }),
]);

export const CreateJobBatchSchema = z
  .object({
    idempotencyKey: z.uuid(),
    items: z.array(JobBatchItemSchema).min(MIN_BATCH_ITEMS).max(MAX_BATCH_ITEMS),
    maxAttempts: z.number().int().min(1).max(MAX_ATTEMPTS_LIMIT).default(DEFAULT_MAX_ATTEMPTS),
    priority: z.number().int().min(1).max(5),
    startAt: z.iso.datetime({ offset: true }).optional(),
    type: z.enum(['instant', 'schedule']),
  })
  .superRefine(refineSchedule);

export class CreateJobBatchDto extends createZodDto(CreateJobBatchSchema) {}
