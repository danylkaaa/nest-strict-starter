import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AircraftSchema = z.object({
  cruiseAltitudeM: z.number().int().positive(),
  cruiseSpeedKmh: z.number().int().positive(),
  id: z.string().regex(/^acf_[0-7][0-9A-HJKMNP-TV-Z]{25}$/u),
  model: z.string(),
  registration: z.string(),
});

export class AircraftListDto extends createZodDto(z.object({ items: z.array(AircraftSchema) })) {}
