import { z } from 'zod';

export interface GeoJsonLineString {
  type: 'LineString';
  /** Positions in [longitude, latitude] order. */
  coordinates: [number, number][];
}

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface Aircraft {
  id: string;
  model: string;
  registration: string;
  cruiseSpeedKmh: number;
  cruiseAltitudeM: number;
}

export interface TransitRequest {
  originIcao: string;
  destinationIcao: string;
  aircraftId: string;
  departureAt: Date;
}

/**
 * Queue payload of an aircraft report job. `departureAt` is an ISO string because the payload is
 * JSON; shared by the HTTP DTO and the worker handler.
 */
export const TransitJobPayloadSchema = z.object({
  aircraftId: z.string().trim().min(1).max(64),
  departureAt: z.iso.datetime({ offset: true }),
  destinationIcao: z.string().regex(/^[A-Za-z]{4}$/u),
  originIcao: z.string().regex(/^[A-Za-z]{4}$/u),
});

export interface ValidatedTransitRequest {
  origin: Airport;
  destination: Airport;
  aircraft: Aircraft;
  departureAt: Date;
}

export interface Waypoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  altitudeM: number;
  speedKmh: number;
}

export interface TransitPath {
  distanceKm: number;
  durationMinutes: number;
  arrivalAt: Date;
  waypoints: Waypoint[];
}

export interface NewTransitReport extends TransitPath {
  jobId: string;
  originIcao: string;
  destinationIcao: string;
  aircraftId: string;
  departureAt: Date;
}

export interface GenerateTransitReportInput extends TransitRequest {
  /** The report job; a repeated job ID returns the report already stored for it. */
  jobId: string;
}

export interface TransitReport extends TransitPath {
  id: string;
  origin: Airport;
  destination: Airport;
  aircraft: Aircraft;
  departureAt: Date;
  createdAt: Date;
}

export interface AircraftTransitReport extends TransitReport {
  path: GeoJsonLineString;
}
