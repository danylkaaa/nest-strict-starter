import { bearing } from '@turf/bearing';
import { destination } from '@turf/destination';
import { distance } from '@turf/distance';
import { point } from '@turf/helpers';

import type {
  Aircraft,
  Airport,
  GeoJsonLineString,
  TransitPath,
  Waypoint,
} from './aircraft-transit.js';

const WAYPOINT_SPACING_KM = 100;
const CLIMB_AND_DESCENT_FRACTION = 0.1;

const toPoint = ({ latitude, longitude }: Pick<Airport, 'latitude' | 'longitude'>) =>
  point([longitude, latitude]);

const normalizeLongitude = (longitude: number) => ((((longitude + 180) % 360) + 360) % 360) - 180;

const altitudeAt = (fraction: number, cruiseAltitudeM: number) => {
  const climb = Math.min(fraction, 1 - fraction) / CLIMB_AND_DESCENT_FRACTION;
  return Math.round(cruiseAltitudeM * Math.min(1, climb));
};

/**
 * Builds a timed waypoint path along the great circle between two airports. Every waypoint moves
 * its share of the total distance along the initial bearing, so the list stays continuous across
 * the antimeridian; longitudes are normalized to [-180, 180].
 */
export function buildTransitPath(
  origin: Airport,
  target: Airport,
  aircraft: Aircraft,
  departureAt: Date,
): TransitPath {
  const from = toPoint(origin);
  const to = toPoint(target);
  const distanceKm = distance(from, to, { units: 'kilometers' });
  const durationMinutes = (distanceKm / aircraft.cruiseSpeedKmh) * 60;
  const durationMs = durationMinutes * 60_000;
  const initialBearing = bearing(from, to);
  const count = Math.max(2, Math.round(distanceKm / WAYPOINT_SPACING_KM) + 1);
  const last = count - 1;

  const waypoints = Array.from({ length: count }, (_, index): Waypoint => {
    const fraction = index / last;
    const [longitude, latitude] =
      index === 0
        ? [origin.longitude, origin.latitude]
        : index === last
          ? [target.longitude, target.latitude]
          : destination(from, distanceKm * fraction, initialBearing, { units: 'kilometers' })
              .geometry.coordinates;

    return {
      altitudeM: altitudeAt(fraction, aircraft.cruiseAltitudeM),
      latitude: latitude ?? 0,
      longitude:
        index === 0 || index === last ? (longitude ?? 0) : normalizeLongitude(longitude ?? 0),
      speedKmh: aircraft.cruiseSpeedKmh,
      timestamp: new Date(departureAt.getTime() + durationMs * fraction),
    };
  });

  return {
    arrivalAt: new Date(departureAt.getTime() + durationMs),
    distanceKm,
    durationMinutes,
    waypoints,
  };
}

export const toGeoJsonLineString = (waypoints: readonly Waypoint[]): GeoJsonLineString => ({
  coordinates: waypoints.map(({ latitude, longitude }): [number, number] => [longitude, latitude]),
  type: 'LineString',
});
