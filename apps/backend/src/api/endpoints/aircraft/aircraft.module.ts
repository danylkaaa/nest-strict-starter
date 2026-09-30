import { Module } from '@nestjs/common';

import { AircraftTransitsModule } from '@/modules/aircraft-transits/aircraft-transits.module.js';

import { AircraftController } from './aircraft.controller.js';

@Module({ controllers: [AircraftController], imports: [AircraftTransitsModule] })
export class AircraftApiModule {}
