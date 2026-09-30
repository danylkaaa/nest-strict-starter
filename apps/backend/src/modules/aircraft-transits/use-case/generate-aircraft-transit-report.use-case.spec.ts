import { describe, expect, it } from 'vitest';

import { CountingDelay } from '@/modules/aircraft-transits/testing/counting.delay.js';
import { AIRCRAFT, KSFO, NOW, RJTT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { unwrap, unwrapError } from '@/modules/aircraft-transits/testing/results.js';

import { GenerateAircraftTransitReportUseCase } from './generate-aircraft-transit-report.use-case.js';

const request = {
  aircraftId: AIRCRAFT.id,
  departureAt: new Date(NOW.getTime() + 3_600_000),
  destinationIcao: 'ksfo',
  originIcao: 'RJTT',
};

const setup = () => {
  const repository = new InMemoryAircraftTransitRepository();
  const delay = new CountingDelay();
  return {
    delay,
    repository,
    useCase: new GenerateAircraftTransitReportUseCase(repository, delay),
  };
};

describe('generateAircraftTransitReportUseCase', () => {
  it('saves and returns a report for the chosen aircraft and airports', async () => {
    const { delay, repository, useCase } = setup();

    const result = await useCase.execute(request);

    const report = unwrap(result);
    expect(delay.calls).toBe(1);
    expect(report.id).toBe('atr_01HZZZZZZZZZZZZZZZZZZZZZZZ');
    expect(report.origin).toEqual(RJTT);
    expect(report.destination).toEqual(KSFO);
    expect(report.aircraft).toEqual(AIRCRAFT);
    expect(report.departureAt).toEqual(request.departureAt);
    expect(report.arrivalAt.getTime()).toBeGreaterThan(request.departureAt.getTime());
    expect(report.waypoints[0]).toMatchObject({ speedKmh: 903 });
    expect(report.path.type).toBe('LineString');
    expect(report.path.coordinates).toHaveLength(report.waypoints.length);
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0]).toMatchObject({
      aircraftId: AIRCRAFT.id,
      destinationIcao: 'KSFO',
      distanceKm: report.distanceKm,
      originIcao: 'RJTT',
    });
  });

  it('does not reject a departure in the past', async () => {
    const { useCase } = setup();

    const result = await useCase.execute({
      ...request,
      departureAt: new Date(NOW.getTime() - 86_400_000),
    });

    expect(unwrap(result).id).toBe('atr_01HZZZZZZZZZZZZZZZZZZZZZZZ');
  });

  it('returns SameAirportError without any lookup, delay, or save', async () => {
    const { delay, repository, useCase } = setup();

    const result = await useCase.execute({ ...request, destinationIcao: 'rjtt' });

    expect(unwrapError(result).name).toBe('SameAirportError');
    expect(repository.lookups).toEqual([]);
    expect(delay.calls).toBe(0);
    expect(repository.saved).toHaveLength(0);
  });

  it('returns UnknownAirportError naming the code and saves nothing', async () => {
    const { repository, useCase } = setup();

    const result = await useCase.execute({ ...request, originIcao: 'zzzz' });

    expect(unwrapError(result).name).toBe('UnknownAirportError');
    expect(unwrapError(result).message).toContain('ZZZZ');
    expect(repository.saved).toHaveLength(0);
  });

  it('returns UnknownAircraftError for an unknown aircraft id', async () => {
    const { repository, useCase } = setup();

    const result = await useCase.execute({ ...request, aircraftId: 'acf_missing' });

    expect(unwrapError(result).name).toBe('UnknownAircraftError');
    expect(repository.saved).toHaveLength(0);
  });
});
