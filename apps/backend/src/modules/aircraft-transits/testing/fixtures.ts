import type { Aircraft, Airport } from '@/modules/aircraft-transits/aircraft-transit.js';

export const RJTT: Airport = {
  city: 'Tokyo',
  country: 'Japan',
  iata: 'HND',
  icao: 'RJTT',
  latitude: 35.5494,
  longitude: 139.7798,
  name: 'Tokyo Haneda Airport',
};

export const KSFO: Airport = {
  city: 'San Francisco',
  country: 'United States',
  iata: 'SFO',
  icao: 'KSFO',
  latitude: 37.6189,
  longitude: -122.375,
  name: 'San Francisco International Airport',
};

export const AIRCRAFT: Aircraft = {
  cruiseAltitudeM: 13_100,
  cruiseSpeedKmh: 903,
  id: 'acf_01HZZZZZZZZZZZZZZZZZZZZZZZ',
  model: 'Boeing 787-9 Dreamliner',
  registration: 'JA871A',
};

export const NOW = new Date('2030-06-01T12:00:00.000Z');
