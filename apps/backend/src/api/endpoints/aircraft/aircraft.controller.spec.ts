import { describe, expect, it } from 'vitest';

import { AIRCRAFT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { unwrap } from '@/modules/aircraft-transits/testing/results.js';
import { ListAircraftUseCase } from '@/modules/aircraft-transits/use-case/list-aircraft.use-case.js';

import { AircraftController } from './aircraft.controller.js';

describe('aircraftController', () => {
  it('returns the listed aircraft as a DTO', async () => {
    const controller = new AircraftController(
      new ListAircraftUseCase(new InMemoryAircraftTransitRepository([], [AIRCRAFT])),
    );

    const result = await controller.list();

    expect(unwrap(result).items).toEqual([AIRCRAFT]);
  });
});
