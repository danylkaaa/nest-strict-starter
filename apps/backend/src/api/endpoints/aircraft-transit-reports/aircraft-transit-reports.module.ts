import { Module } from '@nestjs/common';

import { AircraftTransitsModule } from '@/modules/aircraft-transits/aircraft-transits.module.js';

import { AircraftTransitReportsController } from './aircraft-transit-reports.controller.js';

@Module({ controllers: [AircraftTransitReportsController], imports: [AircraftTransitsModule] })
export class AircraftTransitReportsApiModule {}
