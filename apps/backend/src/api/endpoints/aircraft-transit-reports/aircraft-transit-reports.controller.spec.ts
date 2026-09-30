import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AIRCRAFT, KSFO, NOW, RJTT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { unwrap, unwrapError } from '@/modules/aircraft-transits/testing/results.js';
import { buildTransitPath } from '@/modules/aircraft-transits/transit-path.js';
import { GetAircraftTransitReportUseCase } from '@/modules/aircraft-transits/use-case/get-aircraft-transit-report.use-case.js';

import { AircraftTransitReportsController } from './aircraft-transit-reports.controller.js';
import { AircraftTransitReportDto } from './dtos/aircraft-transit-report.dto.js';

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

const setup = (reports: TransitReport[]) =>
  new AircraftTransitReportsController(
    new GetAircraftTransitReportUseCase(
      new InMemoryAircraftTransitRepository([RJTT, KSFO], [AIRCRAFT], reports),
    ),
  );

describe('aircraft transit reports controller', () => {
  it('serializes the report with ISO times and its waypoints', async () => {
    const report = stored();
    const controller = setup([report]);

    const dto = unwrap(await controller.get({ id: report.id }));

    expect(dto).toMatchObject({
      aircraft: AIRCRAFT,
      arrivalAt: report.arrivalAt.toISOString(),
      departureAt: NOW.toISOString(),
      destination: KSFO,
      distanceKm: report.distanceKm,
      durationMinutes: report.durationMinutes,
      id: report.id,
      origin: RJTT,
    });
    expect(dto.waypoints).toHaveLength(report.waypoints.length);
    expect(dto.waypoints[0]).toEqual({
      altitudeM: report.waypoints[0]?.altitudeM,
      latitude: report.waypoints[0]?.latitude,
      longitude: report.waypoints[0]?.longitude,
      speedKmh: report.waypoints[0]?.speedKmh,
      timestamp: report.waypoints[0]?.timestamp.toISOString(),
    });
    expect(AircraftTransitReportDto.schema.safeParse(dto).success).toBe(true);
  });

  it('maps an unknown report to a 404 with the error code', async () => {
    const controller = setup([]);

    const error = unwrapError(await controller.get({ id: 'atr_missing' }));

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toEqual({
      code: 'AircraftTransitReportNotFoundError',
      message: 'The aircraft transit report was not found.',
    });
  });
});
