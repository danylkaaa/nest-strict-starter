import { describe, expect, it } from 'vitest';

import { AIRCRAFT, KSFO, RJTT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { unwrap } from '@/modules/aircraft-transits/testing/results.js';

import { ListAircraftUseCase } from './list-aircraft.use-case.js';
import { ListAirportsUseCase } from './list-airports.use-case.js';

describe('reference data use cases', () => {
  it('listAirportsUseCase returns the repository airports', async () => {
    const repository = new InMemoryAircraftTransitRepository([KSFO, RJTT]);

    const result = await new ListAirportsUseCase(repository).execute();

    expect(unwrap(result)).toEqual([KSFO, RJTT]);
  });

  it('listAircraftUseCase returns the repository aircraft', async () => {
    const repository = new InMemoryAircraftTransitRepository([], [AIRCRAFT]);

    const result = await new ListAircraftUseCase(repository).execute();

    expect(unwrap(result)).toEqual([AIRCRAFT]);
  });
});
