import { describe, expect, it } from 'vitest';

import { distanceKm, greatCirclePath } from './geo';

const jfk = { lat: 40.64, lon: -73.78 };
const lhr = { lat: 51.47, lon: -0.46 };

describe('distanceKm', () => {
  it('matches the known JFK to LHR great-circle distance', () => {
    expect(distanceKm(jfk, lhr)).toBeCloseTo(5540, -1);
  });
});

describe('greatCirclePath', () => {
  it('starts at the origin and ends at the destination', () => {
    const path = greatCirclePath(jfk, lhr, 16);

    expect(path).toHaveLength(17);
    expect(path[0]).toMatchObject({ fraction: 0 });
    expect(path[0]!.lat).toBeCloseTo(jfk.lat);
    expect(path[0]!.lon).toBeCloseTo(jfk.lon);
    expect(path[16]!.lat).toBeCloseTo(lhr.lat);
    expect(path[16]!.lon).toBeCloseTo(lhr.lon);
    expect(path[16]).toMatchObject({ fraction: 1 });
  });

  it('bows north of the straight line between the airports', () => {
    const middle = greatCirclePath(jfk, lhr, 16)[8]!;

    expect(middle.lat).toBeGreaterThan((jfk.lat + lhr.lat) / 2);
  });
});
