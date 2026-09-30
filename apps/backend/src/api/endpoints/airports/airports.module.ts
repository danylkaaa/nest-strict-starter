import { Module } from '@nestjs/common';

import { AircraftTransitsModule } from '@/modules/aircraft-transits/aircraft-transits.module.js';

import { AirportsController } from './airports.controller.js';

@Module({ controllers: [AirportsController], imports: [AircraftTransitsModule] })
export class AirportsApiModule {}
