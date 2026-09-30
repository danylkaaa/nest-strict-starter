import { describe, expect, it } from 'vitest';

import { KSFO, RJTT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { unwrap } from '@/modules/aircraft-transits/testing/results.js';
import { ListAirportsUseCase } from '@/modules/aircraft-transits/use-case/list-airports.use-case.js';

import { AirportsController } from './airports.controller.js';

describe('airportsController', () => {
  it('returns the listed airports as a DTO', async () => {
    const controller = new AirportsController(
      new ListAirportsUseCase(new InMemoryAircraftTransitRepository([KSFO, RJTT])),
    );

    const result = await controller.list();

    expect(unwrap(result).items).toEqual([KSFO, RJTT]);
  });
});
