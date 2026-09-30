import { Module } from '@nestjs/common';

import { DrizzleAircraftTransitRepository } from './aircraft-transit.repository.js';
import { AIRCRAFT_TRANSIT_REPOSITORY } from './ports/aircraft-transit.repository.js';
import { CLOCK } from './ports/clock.js';
import { SIMULATION_DELAY } from './ports/simulation-delay.js';
import { RandomSimulationDelay } from './random-simulation-delay.js';
import { SystemClock } from './system.clock.js';
import { GenerateAircraftTransitReportUseCase } from './use-case/generate-aircraft-transit-report.use-case.js';
import { GetAircraftTransitReportUseCase } from './use-case/get-aircraft-transit-report.use-case.js';
import { ListAircraftUseCase } from './use-case/list-aircraft.use-case.js';
import { ListAirportsUseCase } from './use-case/list-airports.use-case.js';
import { ValidateAircraftTransitRequestUseCase } from './use-case/validate-aircraft-transit-request.use-case.js';

@Module({
  exports: [
    ValidateAircraftTransitRequestUseCase,
    GenerateAircraftTransitReportUseCase,
    GetAircraftTransitReportUseCase,
    ListAirportsUseCase,
    ListAircraftUseCase,
  ],
  providers: [
    ValidateAircraftTransitRequestUseCase,
    GenerateAircraftTransitReportUseCase,
    GetAircraftTransitReportUseCase,
    ListAirportsUseCase,
    ListAircraftUseCase,
    { provide: AIRCRAFT_TRANSIT_REPOSITORY, useClass: DrizzleAircraftTransitRepository },
    { provide: CLOCK, useClass: SystemClock },
    { provide: SIMULATION_DELAY, useClass: RandomSimulationDelay },
  ],
})
export class AircraftTransitsModule {}
