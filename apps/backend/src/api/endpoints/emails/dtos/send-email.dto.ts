import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SendEmailSchema = z.object({
  body: z.string().trim().min(1).max(100_000),
  recipient: z.email().max(254),
  subject: z.string().trim().min(1).max(998),
});

export class SendEmailDto extends createZodDto(SendEmailSchema) {}
