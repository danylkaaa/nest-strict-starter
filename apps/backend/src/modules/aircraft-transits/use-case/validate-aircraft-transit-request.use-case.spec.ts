import { describe, expect, it } from 'vitest';

import { FixedClock } from '@/modules/aircraft-transits/testing/fixed.clock.js';
import { AIRCRAFT, KSFO, NOW, RJTT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { unwrap, unwrapError } from '@/modules/aircraft-transits/testing/results.js';

import { ValidateAircraftTransitRequestUseCase } from './validate-aircraft-transit-request.use-case.js';

const future = new Date(NOW.getTime() + 3_600_000);
const request = {
  aircraftId: AIRCRAFT.id,
  departureAt: future,
  destinationIcao: 'KSFO',
  originIcao: 'RJTT',
};

const setup = () => {
  const repository = new InMemoryAircraftTransitRepository();
  return {
    repository,
    useCase: new ValidateAircraftTransitRequestUseCase(repository, new FixedClock()),
  };
};

describe('validateAircraftTransitRequestUseCase', () => {
  it('returns the resolved airports and aircraft without saving anything', async () => {
    const { repository, useCase } = setup();

    const result = await useCase.execute(request);

    expect(unwrap(result)).toEqual({
      aircraft: AIRCRAFT,
      departureAt: future,
      destination: KSFO,
      origin: RJTT,
    });
    expect(repository.saved).toHaveLength(0);
  });

  it('compares ICAO codes case-insensitively', async () => {
    const { useCase } = setup();

    const result = await useCase.execute({
      ...request,
      destinationIcao: 'ksfo',
      originIcao: 'rjTt',
    });

    expect(unwrap(result).origin.icao).toBe('RJTT');
  });

  it('returns SameAirportError before any repository lookup', async () => {
    const { repository, useCase } = setup();

    const result = await useCase.execute({ ...request, destinationIcao: 'rjtt' });

    expect(unwrapError(result).name).toBe('SameAirportError');
    expect(repository.lookups).toEqual([]);
  });

  it('names the unknown airport code', async () => {
    const { useCase } = setup();

    const origin = await useCase.execute({ ...request, originIcao: 'zzzz' });
    const destination = await useCase.execute({ ...request, destinationIcao: 'YYYY' });

    expect(unwrapError(origin).name).toBe('UnknownAirportError');
    expect(unwrapError(origin).message).toContain('ZZZZ');
    expect(unwrapError(destination).message).toContain('YYYY');
  });

  it('returns UnknownAircraftError for an unknown aircraft id', async () => {
    const { useCase } = setup();

    const result = await useCase.execute({ ...request, aircraftId: 'acf_missing' });

    expect(unwrapError(result).name).toBe('UnknownAircraftError');
  });

  it('returns DepartureInPastError for a departure before now', async () => {
    const { useCase } = setup();

    const result = await useCase.execute({ ...request, departureAt: new Date(NOW.getTime() - 1) });

    expect(unwrapError(result).name).toBe('DepartureInPastError');
  });
});
