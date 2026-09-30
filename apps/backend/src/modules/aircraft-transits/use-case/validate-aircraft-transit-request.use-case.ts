import { Inject, Injectable } from '@nestjs/common';

import { AIRCRAFT_TRANSIT_REPOSITORY } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import { CLOCK } from '@/modules/aircraft-transits/ports/clock.js';

import { validateTransitRequest } from './validate-transit-request.js';

import type { TransitRequestError } from './validate-transit-request.js';
import type { DepartureInPastError } from '@/modules/aircraft-transits/aircraft-transit.errors.js';
import type {
  TransitRequest,
  ValidatedTransitRequest,
} from '@/modules/aircraft-transits/aircraft-transit.js';
import type { AircraftTransitRepository } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import type { Clock } from '@/modules/aircraft-transits/ports/clock.js';
import type { Result } from 'neverthrow';

export type {
  TransitRequest,
  ValidatedTransitRequest,
} from '@/modules/aircraft-transits/aircraft-transit.js';
export type {
  DepartureInPastError,
  SameAirportError,
  UnknownAircraftError,
  UnknownAirportError,
} from '@/modules/aircraft-transits/aircraft-transit.errors.js';

/** Submission-time validation: includes the past-departure check and saves nothing. */
@Injectable()
export class ValidateAircraftTransitRequestUseCase {
  constructor(
    @Inject(AIRCRAFT_TRANSIT_REPOSITORY) private readonly repository: AircraftTransitRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    input: TransitRequest,
  ): Promise<Result<ValidatedTransitRequest, TransitRequestError | DepartureInPastError>> {
    return validateTransitRequest(this.repository, input, this.clock.now());
  }
}
