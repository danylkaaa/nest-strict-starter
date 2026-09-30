import { createZodDto } from 'nestjs-zod';

import { EmailContentSchema } from '@/modules/emails/email.js';

export const SendEmailSchema = EmailContentSchema;

export class SendEmailDto extends createZodDto(SendEmailSchema) {}
