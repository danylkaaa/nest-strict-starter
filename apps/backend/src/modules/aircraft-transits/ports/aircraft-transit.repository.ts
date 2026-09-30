import type {
  Aircraft,
  Airport,
  NewTransitReport,
  TransitReport,
} from '@/modules/aircraft-transits/aircraft-transit.js';

export const AIRCRAFT_TRANSIT_REPOSITORY = Symbol('AircraftTransitRepository');

export interface AircraftTransitRepository {
  findAirports(icaos: readonly string[]): Promise<Airport[]>;
  findAircraft(id: string): Promise<Aircraft | null>;
  listAirports(): Promise<Airport[]>;
  listAircraft(): Promise<Aircraft[]>;
  /** Stores the report, or returns the one already stored for the same `jobId`. */
  saveReport(report: NewTransitReport): Promise<{ id: string; createdAt: Date }>;
  findReport(id: string): Promise<TransitReport | null>;
}
