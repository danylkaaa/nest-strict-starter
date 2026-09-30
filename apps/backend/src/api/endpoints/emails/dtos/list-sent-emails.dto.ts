import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailIdSchema } from './sent-email.dto.js';

export class ListSentEmailsDto extends createZodDto(
  z.object({
    cursor: EmailIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}
