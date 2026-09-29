import { Module } from '@nestjs/common';

import { AuthWiringModule } from '@/app/auth/auth-wiring.module.js';
import { ConfigModule } from '@/app/config/config.module.js';
import { RequestContextModule } from '@/app/context/request-context.module.js';
import { EnvelopeModule } from '@/app/http/envelope/envelope.module.js';
import { ValidationModule } from '@/app/http/validation/validation.module.js';
import { AppLoggerModule } from '@/app/logger/logger.module.js';

import { AuthModule } from './modules/auth/auth.module.js';
import { GreetingModule } from './modules/greeting/greeting.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule,
    AuthWiringModule,
    // Order matters: the request context must exist before the logger reads it.
    RequestContextModule,
    AppLoggerModule,
    EnvelopeModule,
    ValidationModule,
    AuthModule,
    HealthModule,
    GreetingModule,
  ],
})
export class AppModule {}
