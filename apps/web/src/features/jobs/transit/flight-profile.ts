import type { Aircraft, PathPoint } from '@/features/jobs/job';

// Climb and descent each take this share of the route in the simulated profile
const CLIMB_SHARE = 0.12;
const MIN_SPEED_SHARE = 0.35;

export interface FlightSnapshot {
  altitudeFt: number;
  at: string;
  speedKt: number;
}

/** Simulated altitude, speed, and clock time at a point along the route */
export const flightSnapshot = (
  point: PathPoint,
  aircraft: Aircraft,
  departureAt: string,
  durationMinutes: number,
): FlightSnapshot => {
  const edge = Math.min(point.fraction, 1 - point.fraction) / CLIMB_SHARE;
  const altitudeShare = Math.min(1, edge);
  const speedShare = Math.min(1, MIN_SPEED_SHARE + edge);
  return {
    altitudeFt: Math.round((altitudeShare * aircraft.cruiseAltitudeFt) / 100) * 100,
    at: new Date(Date.parse(departureAt) + point.fraction * durationMinutes * 60_000).toISOString(),
    speedKt: Math.round(speedShare * aircraft.cruiseSpeedKt),
  };
};

/**
 * Shifts longitudes by ±360° so consecutive points never jump across the map,
 * which keeps routes over the date line (e.g. SYD → LAX) as one continuous line.
 */
export const unwrapLongitudes = <T extends { lon: number }>(points: readonly T[]): T[] => {
  const result: T[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    const turns = previous === undefined ? 0 : Math.round((previous.lon - point.lon) / 360);
    result.push({ ...point, lon: point.lon + turns * 360 });
  }
  return result;
};
