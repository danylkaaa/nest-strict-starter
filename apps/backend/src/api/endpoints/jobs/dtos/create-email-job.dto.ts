import { createZodDto } from 'nestjs-zod';

import { EmailContentSchema } from '@/modules/emails/email.js';

import { createJobSchema } from './create-job.schema.js';

export const CreateEmailJobSchema = createJobSchema(EmailContentSchema);

export class CreateEmailJobDto extends createZodDto(CreateEmailJobSchema) {}
