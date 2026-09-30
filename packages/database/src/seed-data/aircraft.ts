interface AircraftSeed {
  cruiseAltitudeM: number;
  cruiseSpeedKmh: number;
  model: string;
  registration: string;
}

export const aircraftSeed: AircraftSeed[] = [
  { cruiseAltitudeM: 11_300, cruiseSpeedKmh: 830, model: 'Airbus A320neo', registration: 'N320AA' },
  { cruiseAltitudeM: 11_900, cruiseSpeedKmh: 840, model: 'Airbus A321neo', registration: 'D-AIEA' },
  {
    cruiseAltitudeM: 12_200,
    cruiseSpeedKmh: 903,
    model: 'Airbus A350-900',
    registration: 'F-HREA',
  },
  {
    cruiseAltitudeM: 12_000,
    cruiseSpeedKmh: 945,
    model: 'Airbus A380-800',
    registration: 'A6-EOA',
  },
  { cruiseAltitudeM: 11_300, cruiseSpeedKmh: 830, model: 'Boeing 737-800', registration: 'N737UA' },
  {
    cruiseAltitudeM: 12_000,
    cruiseSpeedKmh: 905,
    model: 'Boeing 777-300ER',
    registration: 'G-STBA',
  },
  {
    cruiseAltitudeM: 13_100,
    cruiseSpeedKmh: 903,
    model: 'Boeing 787-9 Dreamliner',
    registration: 'JA871A',
  },
  {
    cruiseAltitudeM: 10_700,
    cruiseSpeedKmh: 870,
    model: 'Embraer E195-E2',
    registration: 'PR-ZEA',
  },
];
