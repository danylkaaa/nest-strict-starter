import { z } from 'zod';

/**
 * Submission envelope shared by every queue: the payload schema is the only part that differs.
 * The submission key must be a UUID, scheduled jobs need `startAt`, and instant jobs forbid it.
 */
export const createJobSchema = <TPayload extends z.ZodType>(payload: TPayload) =>
  z
    .object({
      idempotencyKey: z.uuid(),
      payload,
      priority: z.number().int().min(1).max(5),
      startAt: z.iso.datetime({ offset: true }).optional(),
      type: z.enum(['instant', 'schedule']),
    })
    .superRefine((value, context) => {
      if (value.type === 'schedule' && value.startAt === undefined) {
        context.addIssue({
          code: 'custom',
          message: 'startAt is required for scheduled jobs.',
          path: ['startAt'],
        });
      }
      if (value.type === 'instant' && value.startAt !== undefined) {
        context.addIssue({
          code: 'custom',
          message: 'Instant jobs cannot have startAt.',
          path: ['startAt'],
        });
      }
    });
