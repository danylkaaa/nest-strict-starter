import { Module } from '@nestjs/common';

import { ApiConfig } from '@/api/core/config/api.config';
import { ConfigModule } from '@/api/core/config/config.module';
import { RequestContextModule } from '@/api/core/context/request-context.module.js';
import { AppLoggerModule } from '@/api/core/logger/logger.module.js';
import { ValidationModule } from '@/api/core/validation/validation.module.js';
import { DatabaseModule } from '@/common/database/database.module';
import { QueueModule } from '@/common/queue/queue.module.js';

import { EnvelopeModule } from './core/response-envelope/envelope.module.js';
import { AircraftTransitReportsApiModule } from './endpoints/aircraft-transit-reports/aircraft-transit-reports.module.js';
import { AircraftApiModule } from './endpoints/aircraft/aircraft.module.js';
import { AirportsApiModule } from './endpoints/airports/airports.module.js';
import { EmailsApiModule } from './endpoints/emails/emails.module.js';
import { GreetingApiModule } from './endpoints/greeting/greeting.module.js';
import { JobsApiModule } from './endpoints/jobs/jobs.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ApiConfig],
      useFactory: (config: ApiConfig) => config.postgres,
    }),
    QueueModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ApiConfig],
      useFactory: (config: ApiConfig) => config.postgres.url,
    }),
    RequestContextModule,
    AppLoggerModule,
    EnvelopeModule,
    ValidationModule,
    // endpoints
    GreetingApiModule,
    EmailsApiModule,
    AirportsApiModule,
    AircraftApiModule,
    AircraftTransitReportsApiModule,
    JobsApiModule,
  ],
})
export class AppModule {}
