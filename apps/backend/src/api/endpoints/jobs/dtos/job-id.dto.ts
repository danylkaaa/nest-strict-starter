import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class JobIdDto extends createZodDto(z.object({ id: z.uuid() })) {}
