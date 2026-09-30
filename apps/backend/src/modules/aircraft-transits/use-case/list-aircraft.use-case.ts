import { Inject, Injectable } from '@nestjs/common';
import { ok } from 'neverthrow';

import { AIRCRAFT_TRANSIT_REPOSITORY } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';

import type { Aircraft } from '@/modules/aircraft-transits/aircraft-transit.js';
import type { AircraftTransitRepository } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import type { Result } from 'neverthrow';

export type { Aircraft } from '@/modules/aircraft-transits/aircraft-transit.js';

/** Lists every aircraft, sorted by registration. */
@Injectable()
export class ListAircraftUseCase {
  constructor(
    @Inject(AIRCRAFT_TRANSIT_REPOSITORY) private readonly repository: AircraftTransitRepository,
  ) {}

  async execute(): Promise<Result<Aircraft[], never>> {
    return ok(await this.repository.listAircraft());
  }
}
