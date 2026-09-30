import { describe, expect, it } from 'vitest';

import { AIRCRAFT, KSFO, NOW, RJTT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { unwrap, unwrapError } from '@/modules/aircraft-transits/testing/results.js';
import { buildTransitPath } from '@/modules/aircraft-transits/transit-path.js';

import { GetAircraftTransitReportUseCase } from './get-aircraft-transit-report.use-case.js';

import type { TransitReport } from '@/modules/aircraft-transits/aircraft-transit.js';

const stored = (): TransitReport => ({
  ...buildTransitPath(RJTT, KSFO, AIRCRAFT, NOW),
  aircraft: AIRCRAFT,
  createdAt: NOW,
  departureAt: NOW,
  destination: KSFO,
  id: 'atr_01HZZZZZZZZZZZZZZZZZZZZZZZ',
  origin: RJTT,
});

describe('getAircraftTransitReportUseCase', () => {
  it('returns the saved report with a GeoJSON path built from its waypoints', async () => {
    const report = stored();
    const useCase = new GetAircraftTransitReportUseCase(
      new InMemoryAircraftTransitRepository([RJTT, KSFO], [AIRCRAFT], [report]),
    );

    const result = await useCase.execute({ id: report.id });

    const found = unwrap(result);
    expect(found.id).toBe(report.id);
    expect(found.path.coordinates[0]).toEqual([RJTT.longitude, RJTT.latitude]);
    expect(found.path.coordinates).toHaveLength(report.waypoints.length);
  });

  it('returns AircraftTransitReportNotFoundError for an unknown id', async () => {
    const useCase = new GetAircraftTransitReportUseCase(new InMemoryAircraftTransitRepository());

    const result = await useCase.execute({ id: 'atr_missing' });

    expect(unwrapError(result).name).toBe('AircraftTransitReportNotFoundError');
  });
});
