import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const EmailIdSchema = z.string().regex(/^eml_[0-7][0-9A-HJKMNP-TV-Z]{25}$/u);

export const SentEmailSchema = z.object({
  body: z.string(),
  id: EmailIdSchema,
  messageId: z.string(),
  recipient: z.email(),
  sentAt: z.iso.datetime(),
  subject: z.string(),
});

export class SentEmailDto extends createZodDto(SentEmailSchema) {}
