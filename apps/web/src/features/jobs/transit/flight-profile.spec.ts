import { describe, expect, it } from 'vitest';

import { flightSnapshot, unwrapLongitudes } from './flight-profile';

import type { Aircraft } from '@/features/jobs/job';

const aircraft: Aircraft = {
  callsign: 'SKY482',
  cruiseAltitudeFt: 38_000,
  cruiseSpeedKt: 490,
  model: 'Boeing 787-9',
  registration: 'G-ZBKA',
};
const departureAt = '2026-10-03T09:00:00.000Z';

describe('flightSnapshot', () => {
  it('is on the ground at departure', () => {
    expect(flightSnapshot({ fraction: 0, lat: 0, lon: 0 }, aircraft, departureAt, 432)).toEqual({
      altitudeFt: 0,
      at: departureAt,
      speedKt: 172,
    });
  });

  it('cruises mid-route', () => {
    expect(flightSnapshot({ fraction: 0.5, lat: 0, lon: 0 }, aircraft, departureAt, 432)).toEqual({
      altitudeFt: 38_000,
      at: '2026-10-03T12:36:00.000Z',
      speedKt: 490,
    });
  });
});

describe('unwrapLongitudes', () => {
  it('keeps a route over the date line continuous', () => {
    expect(unwrapLongitudes([{ lon: 170 }, { lon: 179 }, { lon: -178 }, { lon: -170 }])).toEqual([
      { lon: 170 },
      { lon: 179 },
      { lon: 182 },
      { lon: 190 },
    ]);
  });

  it('leaves ordinary routes unchanged', () => {
    const route = [{ lon: -73 }, { lon: -40 }, { lon: -0.4 }];

    expect(unwrapLongitudes(route)).toEqual(route);
  });
});
