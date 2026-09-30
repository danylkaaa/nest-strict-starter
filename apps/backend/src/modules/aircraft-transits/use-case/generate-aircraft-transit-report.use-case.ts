import { Inject, Injectable } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import { AIRCRAFT_TRANSIT_REPOSITORY } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import { SIMULATION_DELAY } from '@/modules/aircraft-transits/ports/simulation-delay.js';
import { buildTransitPath, toGeoJsonLineString } from '@/modules/aircraft-transits/transit-path.js';

import { validateTransitRequest } from './validate-transit-request.js';

import type { TransitRequestError } from './validate-transit-request.js';
import type {
  AircraftTransitReport,
  TransitRequest,
} from '@/modules/aircraft-transits/aircraft-transit.js';
import type { AircraftTransitRepository } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import type { SimulationDelay } from '@/modules/aircraft-transits/ports/simulation-delay.js';
import type { Result } from 'neverthrow';

export type {
  AircraftTransitReport,
  TransitRequest,
} from '@/modules/aircraft-transits/aircraft-transit.js';
export type {
  SameAirportError,
  UnknownAircraftError,
  UnknownAirportError,
} from '@/modules/aircraft-transits/aircraft-transit.errors.js';

/**
 * Generates and saves a synthetic report. Skips the past-departure check so queued or retried
 * jobs do not fail because time moved on.
 */
@Injectable()
export class GenerateAircraftTransitReportUseCase {
  constructor(
    @Inject(AIRCRAFT_TRANSIT_REPOSITORY) private readonly repository: AircraftTransitRepository,
    @Inject(SIMULATION_DELAY) private readonly delay: SimulationDelay,
  ) {}

  async execute(
    input: TransitRequest,
  ): Promise<Result<AircraftTransitReport, TransitRequestError>> {
    const validated = await validateTransitRequest(this.repository, input);
    if (validated.isErr()) return err(validated.error);
    const { aircraft, departureAt, destination, origin } = validated.value;

    await this.delay.wait();
    const path = buildTransitPath(origin, destination, aircraft, departureAt);
    const saved = await this.repository.saveReport({
      ...path,
      aircraftId: aircraft.id,
      departureAt,
      destinationIcao: destination.icao,
      originIcao: origin.icao,
    });

    return ok({
      ...path,
      aircraft,
      createdAt: saved.createdAt,
      departureAt,
      destination,
      id: saved.id,
      origin,
      path: toGeoJsonLineString(path.waypoints),
    });
  }
}
