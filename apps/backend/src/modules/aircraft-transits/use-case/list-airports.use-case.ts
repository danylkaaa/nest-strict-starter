import { Inject, Injectable } from '@nestjs/common';
import { ok } from 'neverthrow';

import { AIRCRAFT_TRANSIT_REPOSITORY } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';

import type { Airport } from '@/modules/aircraft-transits/aircraft-transit.js';
import type { AircraftTransitRepository } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import type { Result } from 'neverthrow';

export type { Airport } from '@/modules/aircraft-transits/aircraft-transit.js';

/** Lists every airport, sorted by ICAO code. */
@Injectable()
export class ListAirportsUseCase {
  constructor(
    @Inject(AIRCRAFT_TRANSIT_REPOSITORY) private readonly repository: AircraftTransitRepository,
  ) {}

  async execute(): Promise<Result<Airport[], never>> {
    return ok(await this.repository.listAirports());
  }
}
