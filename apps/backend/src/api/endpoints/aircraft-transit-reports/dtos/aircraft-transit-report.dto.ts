import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AircraftSchema } from '@/api/endpoints/aircraft/dtos/aircraft.dto.js';
import { AirportSchema } from '@/api/endpoints/airports/dtos/airport.dto.js';

export const WaypointSchema = z.object({
  altitudeM: z.number(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedKmh: z.number(),
  timestamp: z.iso.datetime(),
});

export class AircraftTransitReportDto extends createZodDto(
  z.object({
    aircraft: AircraftSchema,
    arrivalAt: z.iso.datetime(),
    departureAt: z.iso.datetime(),
    destination: AirportSchema,
    distanceKm: z.number(),
    durationMinutes: z.number(),
    id: z.string(),
    origin: AirportSchema,
    waypoints: z.array(WaypointSchema),
  }),
) {}
