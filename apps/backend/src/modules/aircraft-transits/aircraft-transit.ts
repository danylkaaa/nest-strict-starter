export interface GeoJsonLineString {
  type: 'LineString';
  /** Positions in [longitude, latitude] order. */
  coordinates: [number, number][];
}

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface Aircraft {
  id: string;
  model: string;
  registration: string;
  cruiseSpeedKmh: number;
  cruiseAltitudeM: number;
}

export interface TransitRequest {
  originIcao: string;
  destinationIcao: string;
  aircraftId: string;
  departureAt: Date;
}

export interface ValidatedTransitRequest {
  origin: Airport;
  destination: Airport;
  aircraft: Aircraft;
  departureAt: Date;
}

export interface Waypoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  altitudeM: number;
  speedKmh: number;
}

export interface TransitPath {
  distanceKm: number;
  durationMinutes: number;
  arrivalAt: Date;
  waypoints: Waypoint[];
}

export interface NewTransitReport extends TransitPath {
  originIcao: string;
  destinationIcao: string;
  aircraftId: string;
  departureAt: Date;
}

export interface TransitReport extends TransitPath {
  id: string;
  origin: Airport;
  destination: Airport;
  aircraft: Aircraft;
  departureAt: Date;
  createdAt: Date;
}

export interface AircraftTransitReport extends TransitReport {
  path: GeoJsonLineString;
}
