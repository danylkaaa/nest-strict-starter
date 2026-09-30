import { createDrizzleInstance } from '@workspace/database/client';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DrizzleAircraftTransitRepository } from './aircraft-transit.repository.js';
import { buildTransitPath } from './transit-path.js';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const repository = new DrizzleAircraftTransitRepository(createDrizzleInstance(pool));

const required = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('Seed the database first: pnpm db:seed.');
  return value;
};

// Requires a migrated and seeded database: pnpm db:migrate && pnpm db:seed.
describe('drizzle aircraft transit repository', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists airports sorted by ICAO code', async () => {
    const airports = await repository.listAirports();
    const icaos = airports.map((airport) => airport.icao);

    expect(icaos.length).toBeGreaterThanOrEqual(35);
    expect(icaos).toEqual([...icaos].toSorted());
  });

  it('lists aircraft sorted by registration', async () => {
    const aircraft = await repository.listAircraft();
    const registrations = aircraft.map((entry) => entry.registration);

    expect(registrations.length).toBeGreaterThan(0);
    expect(registrations).toEqual([...registrations].toSorted());
  });

  it('finds airports by ICAO and aircraft by id', async () => {
    const airports = await repository.findAirports(['RJTT', 'KSFO', 'ZZZZ']);
    const aircraft = required((await repository.listAircraft())[0]);

    expect(airports.map((airport) => airport.icao).toSorted()).toEqual(['KSFO', 'RJTT']);
    expect(await repository.findAircraft(aircraft.id)).toEqual(aircraft);
    expect(await repository.findAircraft('acf_missing')).toBeNull();
  });

  it('saves a report and finds it with joined airports and aircraft', async () => {
    const airports = await repository.findAirports(['RJTT', 'KSFO']);
    const origin = required(airports.find((airport) => airport.icao === 'RJTT'));
    const destination = required(airports.find((airport) => airport.icao === 'KSFO'));
    const aircraft = required((await repository.listAircraft())[0]);
    const departureAt = new Date('2031-01-01T10:00:00.000Z');
    const path = buildTransitPath(origin, destination, aircraft, departureAt);

    const saved = await repository.saveReport({
      ...path,
      aircraftId: aircraft.id,
      departureAt,
      destinationIcao: destination.icao,
      originIcao: origin.icao,
    });
    const found = await repository.findReport(saved.id);

    expect(saved.id).toMatch(/^atr_[0-7][0-9A-HJKMNP-TV-Z]{25}$/u);
    expect(found).toEqual({
      ...path,
      aircraft,
      createdAt: saved.createdAt,
      departureAt,
      destination,
      id: saved.id,
      origin,
    });
  });

  it('returns null for an unknown report id', async () => {
    expect(await repository.findReport('atr_missing')).toBeNull();
  });
});
