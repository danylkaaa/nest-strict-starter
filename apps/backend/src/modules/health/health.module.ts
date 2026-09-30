import { Module } from '@nestjs/common';

import { POSTGRES_HEALTH_PROBE } from './application/ports/postgres-health-probe.port.js';
import { PostgresHealthProbe } from './infrastructure/postgres-health-probe.js';
import { HealthController } from './presentation/health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [{ provide: POSTGRES_HEALTH_PROBE, useClass: PostgresHealthProbe }],
})
export class HealthModule {}
