import type { PathPoint } from '@/features/jobs/job';

interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const toDeg = (radians: number) => (radians * 180) / Math.PI;

// Central angle between two points (haversine)
const centralAngle = (a: LatLon, b: LatLon) =>
  2 *
  Math.asin(
    Math.sqrt(
      Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2,
    ),
  );

export const distanceKm = (a: LatLon, b: LatLon): number => centralAngle(a, b) * EARTH_RADIUS_KM;

// Spherical interpolation along the great circle, `segments + 1` points including both ends
export const greatCirclePath = (a: LatLon, b: LatLon, segments: number): PathPoint[] => {
  const angle = centralAngle(a, b);
  return Array.from({ length: segments + 1 }, (_, index) => {
    const fraction = index / segments;
    const weightA = Math.sin((1 - fraction) * angle) / Math.sin(angle);
    const weightB = Math.sin(fraction * angle) / Math.sin(angle);
    const x =
      weightA * Math.cos(toRad(a.lat)) * Math.cos(toRad(a.lon)) +
      weightB * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon));
    const y =
      weightA * Math.cos(toRad(a.lat)) * Math.sin(toRad(a.lon)) +
      weightB * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon));
    const z = weightA * Math.sin(toRad(a.lat)) + weightB * Math.sin(toRad(b.lat));
    return {
      fraction,
      lat: toDeg(Math.atan2(z, Math.hypot(x, y))),
      lon: toDeg(Math.atan2(y, x)),
    };
  });
};
