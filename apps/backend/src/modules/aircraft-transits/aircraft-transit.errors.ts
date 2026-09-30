import { DomainError } from '@/common/errors/domain-error.js';

export class UnknownAirportError extends DomainError {
  override readonly name = 'UnknownAirportError';

  constructor(readonly code: string) {
    super(`Airport ${code} is not available.`);
  }
}

export class UnknownAircraftError extends DomainError {
  override readonly name = 'UnknownAircraftError';

  constructor(readonly aircraftId: string) {
    super(`Aircraft ${aircraftId} is not available.`);
  }
}

export class SameAirportError extends DomainError {
  override readonly name = 'SameAirportError';

  constructor() {
    super('Origin and destination must be different airports.');
  }
}

export class DepartureInPastError extends DomainError {
  override readonly name = 'DepartureInPastError';

  constructor() {
    super('The departure time must not be in the past.');
  }
}

export class AircraftTransitReportNotFoundError extends DomainError {
  override readonly name = 'AircraftTransitReportNotFoundError';

  constructor() {
    super('The aircraft transit report was not found.');
  }
}
