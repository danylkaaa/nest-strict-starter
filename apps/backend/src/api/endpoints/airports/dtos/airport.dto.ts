import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AirportSchema = z.object({
  city: z.string(),
  country: z.string(),
  iata: z.string(),
  icao: z.string().regex(/^[A-Z]{4}$/u),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string(),
});

export class AirportsDto extends createZodDto(z.object({ items: z.array(AirportSchema) })) {}
