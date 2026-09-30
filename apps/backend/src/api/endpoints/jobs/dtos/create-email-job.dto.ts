import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailContentSchema } from '@/modules/emails/email.js';

export const CreateEmailJobSchema = z
  .object({
    idempotencyKey: z.uuid(),
    payload: EmailContentSchema,
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

export class CreateEmailJobDto extends createZodDto(CreateEmailJobSchema) {}
