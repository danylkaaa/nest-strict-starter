import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { AircraftTransitReportNotFoundError } from '@/modules/aircraft-transits/aircraft-transit.errors.js';
import { AIRCRAFT_TRANSIT_REPOSITORY } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import { toGeoJsonLineString } from '@/modules/aircraft-transits/transit-path.js';

import type { AircraftTransitReport } from '@/modules/aircraft-transits/aircraft-transit.js';
import type { AircraftTransitRepository } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import type { Result } from 'neverthrow';

export type { AircraftTransitReport } from '@/modules/aircraft-transits/aircraft-transit.js';
export type { AircraftTransitReportNotFoundError } from '@/modules/aircraft-transits/aircraft-transit.errors.js';

@Injectable()
export class GetAircraftTransitReportUseCase {
  constructor(
    @Inject(AIRCRAFT_TRANSIT_REPOSITORY) private readonly repository: AircraftTransitRepository,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AircraftTransitReport, AircraftTransitReportNotFoundError>> {
    const report = await this.repository.findReport(input.id);
    if (!report) return err(new AircraftTransitReportNotFoundError());
    return ok({ ...report, path: toGeoJsonLineString(report.waypoints) });
  }
}
