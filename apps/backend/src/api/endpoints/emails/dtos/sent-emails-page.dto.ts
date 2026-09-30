import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailIdSchema, SentEmailSchema } from './sent-email.dto.js';

export class SentEmailsPageDto extends createZodDto(
  z.object({ items: z.array(SentEmailSchema), nextCursor: EmailIdSchema.nullable() }),
) {}
