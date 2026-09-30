import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { aircraft, aircraftTransitReports, airports } from '@workspace/database/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { NewTransitReport, TransitReport, Waypoint } from './aircraft-transit.js';
import type { AircraftTransitRepository } from './ports/aircraft-transit.repository.js';
import type { Database } from '@workspace/database/client';
import type { StoredWaypoint } from '@workspace/database/schema';

const toStoredWaypoint = (waypoint: Waypoint): StoredWaypoint => ({
  altitudeM: waypoint.altitudeM,
  latitude: waypoint.latitude,
  longitude: waypoint.longitude,
  speedKmh: waypoint.speedKmh,
  timestamp: waypoint.timestamp.toISOString(),
});

const fromStoredWaypoint = (waypoint: StoredWaypoint): Waypoint => ({
  altitudeM: waypoint.altitudeM,
  latitude: waypoint.latitude,
  longitude: waypoint.longitude,
  speedKmh: waypoint.speedKmh,
  timestamp: new Date(waypoint.timestamp),
});

@Injectable()
export class DrizzleAircraftTransitRepository implements AircraftTransitRepository {
  constructor(@Inject(getDrizzleToken()) private readonly database: Database) {}

  async findAirports(icaos: readonly string[]) {
    if (icaos.length === 0) return [];
    return this.database
      .select()
      .from(airports)
      .where(inArray(airports.icao, [...icaos]))
      .catch(() => {
        throw new Error('Failed to find airports.');
      });
  }

  async findAircraft(id: string) {
    const [found] = await this.database
      .select()
      .from(aircraft)
      .where(eq(aircraft.id, id))
      .catch(() => {
        throw new Error('Failed to find aircraft.');
      });
    return found ?? null;
  }

  async listAirports() {
    return this.database
      .select()
      .from(airports)
      .orderBy(asc(airports.icao))
      .catch(() => {
        throw new Error('Failed to list airports.');
      });
  }

  async listAircraft() {
    return this.database
      .select()
      .from(aircraft)
      .orderBy(asc(aircraft.registration))
      .catch(() => {
        throw new Error('Failed to list aircraft.');
      });
  }

  async saveReport(report: NewTransitReport) {
    const [saved] = await this.database
      .insert(aircraftTransitReports)
      .values({
        aircraftId: report.aircraftId,
        arrivalAt: report.arrivalAt,
        departureAt: report.departureAt,
        destinationIcao: report.destinationIcao,
        distanceKm: report.distanceKm,
        durationMinutes: report.durationMinutes,
        originIcao: report.originIcao,
        waypoints: report.waypoints.map((waypoint) => toStoredWaypoint(waypoint)),
      })
      .returning({ createdAt: aircraftTransitReports.createdAt, id: aircraftTransitReports.id })
      .catch(() => {
        throw new Error('Failed to persist aircraft transit report.');
      });
    if (!saved) throw new Error('Aircraft transit report insert returned no record.');
    return saved;
  }

  async findReport(id: string): Promise<TransitReport | null> {
    const origin = alias(airports, 'origin');
    const destination = alias(airports, 'destination');
    const [row] = await this.database
      .select({
        aircraft,
        destination,
        origin,
        report: aircraftTransitReports,
      })
      .from(aircraftTransitReports)
      .innerJoin(origin, eq(aircraftTransitReports.originIcao, origin.icao))
      .innerJoin(destination, eq(aircraftTransitReports.destinationIcao, destination.icao))
      .innerJoin(aircraft, eq(aircraftTransitReports.aircraftId, aircraft.id))
      .where(eq(aircraftTransitReports.id, id))
      .catch(() => {
        throw new Error('Failed to find aircraft transit report.');
      });
    if (!row) return null;

    const { report } = row;
    return {
      aircraft: row.aircraft,
      arrivalAt: report.arrivalAt,
      createdAt: report.createdAt,
      departureAt: report.departureAt,
      destination: row.destination,
      distanceKm: report.distanceKm,
      durationMinutes: report.durationMinutes,
      id: report.id,
      origin: row.origin,
      waypoints: report.waypoints.map((waypoint) => fromStoredWaypoint(waypoint)),
    };
  }
}
