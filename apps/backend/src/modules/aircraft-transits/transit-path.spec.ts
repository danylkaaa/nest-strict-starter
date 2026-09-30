import { distance } from '@turf/distance';
import { describe, expect, it } from 'vitest';

import { buildTransitPath, toGeoJsonLineString } from './transit-path.js';

import type { Aircraft, Airport } from './aircraft-transit.js';

const airport = (icao: string, latitude: number, longitude: number): Airport => ({
  city: icao,
  country: 'Testland',
  iata: icao.slice(1),
  icao,
  latitude,
  longitude,
  name: `${icao} airport`,
});

const EGLL = airport('EGLL', 51.4706, -0.4619);
const KJFK = airport('KJFK', 40.6398, -73.7789);
const RJTT = airport('RJTT', 35.5494, 139.7798);
const KSFO = airport('KSFO', 37.6189, -122.375);

const aircraft: Aircraft = {
  cruiseAltitudeM: 11_000,
  cruiseSpeedKmh: 900,
  id: 'acf_01HZZZZZZZZZZZZZZZZZZZZZZZ',
  model: 'Test 900',
  registration: 'T-EST',
};

const departureAt = new Date('2030-01-01T10:00:00.000Z');

const km = (from: { latitude: number; longitude: number }, to: typeof from) =>
  distance([from.longitude, from.latitude], [to.longitude, to.latitude], { units: 'kilometers' });

describe('buildTransitPath', () => {
  it('computes the great-circle distance', () => {
    const path = buildTransitPath(EGLL, KJFK, aircraft, departureAt);

    expect(path.distanceKm).toBeGreaterThan(5540 * 0.99);
    expect(path.distanceKm).toBeLessThan(5540 * 1.01);
  });

  it('derives duration and arrival from distance and cruise speed', () => {
    const path = buildTransitPath(EGLL, KJFK, aircraft, departureAt);

    expect(path.durationMinutes).toBeCloseTo((path.distanceKm / 900) * 60, 6);
    const elapsedMs = path.arrivalAt.getTime() - departureAt.getTime();
    expect(Math.abs(elapsedMs - path.durationMinutes * 60_000)).toBeLessThanOrEqual(1);
  });

  it('places roughly one waypoint per 100 km and at least two', () => {
    const long = buildTransitPath(EGLL, KJFK, aircraft, departureAt);
    expect(long.waypoints).toHaveLength(Math.round(long.distanceKm / 100) + 1);

    const nearby = buildTransitPath(
      airport('AAAA', 10, 10),
      airport('BBBB', 10.1, 10.1),
      aircraft,
      departureAt,
    );
    expect(nearby.waypoints).toHaveLength(2);
  });

  it('starts and ends exactly at the airport coordinates', () => {
    const { waypoints } = buildTransitPath(EGLL, KJFK, aircraft, departureAt);

    expect(waypoints[0]).toMatchObject({ latitude: EGLL.latitude, longitude: EGLL.longitude });
    expect(waypoints.at(-1)).toMatchObject({
      latitude: KJFK.latitude,
      longitude: KJFK.longitude,
    });
  });

  it('has strictly increasing timestamps from departure to arrival', () => {
    const { arrivalAt, waypoints } = buildTransitPath(EGLL, KJFK, aircraft, departureAt);

    expect(waypoints[0]?.timestamp).toEqual(departureAt);
    expect(waypoints.at(-1)?.timestamp).toEqual(arrivalAt);
    for (let i = 1; i < waypoints.length; i += 1) {
      expect(waypoints[i]!.timestamp.getTime()).toBeGreaterThan(
        waypoints[i - 1]!.timestamp.getTime(),
      );
    }
  });

  it('reports cruise speed at every waypoint', () => {
    const { waypoints } = buildTransitPath(EGLL, KJFK, aircraft, departureAt);

    expect(waypoints.every((waypoint) => waypoint.speedKmh === 900)).toBe(true);
  });

  it('climbs over the first 10%, cruises, and descends over the last 10%', () => {
    const { waypoints } = buildTransitPath(EGLL, KJFK, aircraft, departureAt);
    const last = waypoints.length - 1;
    const mid = Math.floor(last / 2);

    expect(waypoints[0]?.altitudeM).toBe(0);
    expect(waypoints[last]?.altitudeM).toBe(0);
    expect(waypoints[mid]?.altitudeM).toBe(11_000);
    expect(waypoints[1]!.altitudeM).toBeGreaterThan(0);
    expect(waypoints[1]!.altitudeM).toBeLessThan(11_000);
    expect(waypoints[last - 1]!.altitudeM).toBeGreaterThan(0);
    expect(waypoints[last - 1]!.altitudeM).toBeLessThan(11_000);
  });

  it('builds one continuous list across the antimeridian', () => {
    const { waypoints } = buildTransitPath(RJTT, KSFO, aircraft, departureAt);

    const longitudes = waypoints.map((waypoint) => waypoint.longitude);
    expect(Math.min(...longitudes)).toBeGreaterThanOrEqual(-180);
    expect(Math.max(...longitudes)).toBeLessThanOrEqual(180);
    // The route passes through both hemispheres of longitude, so the list must jump sign once.
    expect(Math.min(...longitudes)).toBeLessThan(-170);
    expect(Math.max(...longitudes)).toBeGreaterThan(139);
    for (let i = 1; i < waypoints.length; i += 1) {
      expect(km(waypoints[i - 1]!, waypoints[i]!)).toBeLessThan(110);
    }
  });
});

describe('toGeoJsonLineString', () => {
  it('returns a LineString with [lon, lat] coordinates', () => {
    const { waypoints } = buildTransitPath(EGLL, KJFK, aircraft, departureAt);

    const line = toGeoJsonLineString(waypoints);

    expect(line.type).toBe('LineString');
    expect(line.coordinates).toHaveLength(waypoints.length);
    expect(line.coordinates[0]).toEqual([EGLL.longitude, EGLL.latitude]);
    expect(line.coordinates.at(-1)).toEqual([KJFK.longitude, KJFK.latitude]);
  });
});
