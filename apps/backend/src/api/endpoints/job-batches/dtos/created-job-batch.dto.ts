import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CreatedJobBatchDto extends createZodDto(
  z.object({ id: z.uuid(), startAt: z.iso.datetime() }),
) {}
