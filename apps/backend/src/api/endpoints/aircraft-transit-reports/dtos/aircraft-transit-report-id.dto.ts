import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class AircraftTransitReportIdDto extends createZodDto(
  z.object({ id: z.string().min(1).max(64) }),
) {}
