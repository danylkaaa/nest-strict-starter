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
  saveReport(report: NewTransitReport): Promise<{ id: string; createdAt: Date }>;
  findReport(id: string): Promise<TransitReport | null>;
}
