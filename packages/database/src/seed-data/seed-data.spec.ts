import { describe, expect, it } from 'vitest';

import { aircraftSeed } from './aircraft.js';
import { airportSeed } from './airports.js';

describe('airport seed data', () => {
  it('has about 40 airports', () => {
    expect(airportSeed.length).toBeGreaterThanOrEqual(35);
    expect(airportSeed.length).toBeLessThanOrEqual(45);
  });

  it('has unique uppercase four-letter ICAO codes and unique IATA codes', () => {
    const icaos = airportSeed.map((airport) => airport.icao);
    expect(new Set(icaos).size).toBe(icaos.length);
    expect(icaos.every((icao) => /^[A-Z]{4}$/u.test(icao))).toBe(true);
    const iatas = airportSeed.map((airport) => airport.iata);
    expect(new Set(iatas).size).toBe(iatas.length);
  });

  it('has valid coordinates', () => {
    for (const airport of airportSeed) {
      expect(airport.latitude).toBeGreaterThanOrEqual(-90);
      expect(airport.latitude).toBeLessThanOrEqual(90);
      expect(airport.longitude).toBeGreaterThanOrEqual(-180);
      expect(airport.longitude).toBeLessThanOrEqual(180);
    }
  });

  it('includes the antimeridian-crossing pair RJTT and KSFO', () => {
    const icaos = airportSeed.map((airport) => airport.icao);
    expect(icaos).toEqual(expect.arrayContaining(['RJTT', 'KSFO']));
  });
});

describe('aircraft seed data', () => {
  it('has unique registrations and positive performance values', () => {
    const registrations = aircraftSeed.map((entry) => entry.registration);
    expect(new Set(registrations).size).toBe(registrations.length);
    for (const entry of aircraftSeed) {
      expect(entry.cruiseSpeedKmh).toBeGreaterThan(0);
      expect(entry.cruiseAltitudeM).toBeGreaterThan(0);
    }
  });
});
