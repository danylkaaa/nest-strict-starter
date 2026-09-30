import type { Aircraft, Airport } from '@/features/jobs/job';

export const AIRPORTS: readonly Airport[] = [
  { city: 'New York', code: 'JFK', lat: 40.64, lon: -73.78, name: 'John F. Kennedy Intl' },
  { city: 'London', code: 'LHR', lat: 51.47, lon: -0.46, name: 'Heathrow' },
  { city: 'Paris', code: 'CDG', lat: 49.01, lon: 2.55, name: 'Charles de Gaulle' },
  { city: 'Frankfurt', code: 'FRA', lat: 50.03, lon: 8.56, name: 'Frankfurt am Main' },
  { city: 'Kyiv', code: 'KBP', lat: 50.34, lon: 30.89, name: 'Boryspil Intl' },
  { city: 'Dubai', code: 'DXB', lat: 25.25, lon: 55.36, name: 'Dubai Intl' },
  { city: 'Singapore', code: 'SIN', lat: 1.36, lon: 103.99, name: 'Changi' },
  { city: 'Tokyo', code: 'HND', lat: 35.55, lon: 139.78, name: 'Haneda' },
  { city: 'Sydney', code: 'SYD', lat: -33.95, lon: 151.18, name: 'Kingsford Smith' },
  { city: 'Los Angeles', code: 'LAX', lat: 33.94, lon: -118.41, name: 'Los Angeles Intl' },
  { city: 'San Francisco', code: 'SFO', lat: 37.62, lon: -122.38, name: 'San Francisco Intl' },
  { city: 'Chicago', code: 'ORD', lat: 41.98, lon: -87.9, name: "O'Hare Intl" },
  { city: 'Toronto', code: 'YYZ', lat: 43.68, lon: -79.63, name: 'Pearson Intl' },
  { city: 'São Paulo', code: 'GRU', lat: -23.43, lon: -46.47, name: 'Guarulhos Intl' },
  { city: 'Istanbul', code: 'IST', lat: 41.26, lon: 28.74, name: 'Istanbul Airport' },
  { city: 'Johannesburg', code: 'JNB', lat: -26.13, lon: 28.24, name: 'O. R. Tambo Intl' },
];

export const findAirport = (code: string): Airport | undefined =>
  AIRPORTS.find((airport) => airport.code === code);

export const AIRCRAFT: readonly Aircraft[] = [
  {
    callsign: 'SKY482',
    cruiseAltitudeFt: 38_000,
    cruiseSpeedKt: 490,
    model: 'Boeing 787-9',
    registration: 'G-ZBKA',
  },
  {
    callsign: 'AER117',
    cruiseAltitudeFt: 36_000,
    cruiseSpeedKt: 470,
    model: 'Airbus A321neo',
    registration: 'D-AYAB',
  },
  {
    callsign: 'PAC903',
    cruiseAltitudeFt: 41_000,
    cruiseSpeedKt: 505,
    model: 'Airbus A350-900',
    registration: '9V-SMA',
  },
  {
    callsign: 'NRD256',
    cruiseAltitudeFt: 35_000,
    cruiseSpeedKt: 450,
    model: 'Boeing 737 MAX 8',
    registration: 'UR-PSA',
  },
];
