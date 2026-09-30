import { AIRCRAFT, KSFO, NOW, RJTT } from './fixtures.js';

import type {
  Aircraft,
  Airport,
  NewTransitReport,
  TransitReport,
} from '@/modules/aircraft-transits/aircraft-transit.js';
import type { AircraftTransitRepository } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';

export class InMemoryAircraftTransitRepository implements AircraftTransitRepository {
  readonly lookups: string[] = [];
  readonly saved: NewTransitReport[] = [];

  constructor(
    private readonly airports: Airport[] = [RJTT, KSFO],
    private readonly aircraft: Aircraft[] = [AIRCRAFT],
    private readonly reports: TransitReport[] = [],
  ) {}

  findAirports(icaos: readonly string[]) {
    this.lookups.push('findAirports');
    return Promise.resolve(this.airports.filter((airport) => icaos.includes(airport.icao)));
  }

  findAircraft(id: string) {
    this.lookups.push('findAircraft');
    return Promise.resolve(this.aircraft.find((candidate) => candidate.id === id) ?? null);
  }

  listAirports() {
    this.lookups.push('listAirports');
    return Promise.resolve([...this.airports]);
  }

  listAircraft() {
    this.lookups.push('listAircraft');
    return Promise.resolve([...this.aircraft]);
  }

  saveReport(report: NewTransitReport) {
    this.saved.push(report);
    return Promise.resolve({ createdAt: NOW, id: 'atr_01HZZZZZZZZZZZZZZZZZZZZZZZ' });
  }

  findReport(id: string) {
    return Promise.resolve(this.reports.find((report) => report.id === id) ?? null);
  }
}
