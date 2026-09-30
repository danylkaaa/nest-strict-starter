import { err, ok } from 'neverthrow';

import {
  DepartureInPastError,
  SameAirportError,
  UnknownAircraftError,
  UnknownAirportError,
} from '@/modules/aircraft-transits/aircraft-transit.errors.js';

import type {
  TransitRequest,
  ValidatedTransitRequest,
} from '@/modules/aircraft-transits/aircraft-transit.js';
import type { AircraftTransitRepository } from '@/modules/aircraft-transits/ports/aircraft-transit.repository.js';
import type { Result } from 'neverthrow';

export type TransitRequestError = SameAirportError | UnknownAirportError | UnknownAircraftError;

/**
 * Private to the feature: shared by the Validate and Generate use cases. The past-departure check
 * runs only when `rejectDeparturesBefore` is given, so queued or retried generation is not
 * rejected because time moved on.
 */
export function validateTransitRequest(
  repository: AircraftTransitRepository,
  request: TransitRequest,
): Promise<Result<ValidatedTransitRequest, TransitRequestError>>;
export function validateTransitRequest(
  repository: AircraftTransitRepository,
  request: TransitRequest,
  rejectDeparturesBefore: Date,
): Promise<Result<ValidatedTransitRequest, TransitRequestError | DepartureInPastError>>;
export async function validateTransitRequest(
  repository: AircraftTransitRepository,
  request: TransitRequest,
  rejectDeparturesBefore?: Date,
): Promise<Result<ValidatedTransitRequest, TransitRequestError | DepartureInPastError>> {
  const originIcao = request.originIcao.toUpperCase();
  const destinationIcao = request.destinationIcao.toUpperCase();
  if (originIcao === destinationIcao) return err(new SameAirportError());

  const airports = await repository.findAirports([originIcao, destinationIcao]);
  const origin = airports.find((airport) => airport.icao === originIcao);
  if (!origin) return err(new UnknownAirportError(originIcao));
  const destination = airports.find((airport) => airport.icao === destinationIcao);
  if (!destination) return err(new UnknownAirportError(destinationIcao));

  const aircraft = await repository.findAircraft(request.aircraftId);
  if (!aircraft) return err(new UnknownAircraftError(request.aircraftId));

  if (rejectDeparturesBefore && request.departureAt < rejectDeparturesBefore) {
    return err(new DepartureInPastError());
  }

  return ok({ aircraft, departureAt: request.departureAt, destination, origin });
}
