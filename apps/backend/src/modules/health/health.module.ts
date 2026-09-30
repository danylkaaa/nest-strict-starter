import { Module } from '@nestjs/common';

import { JobsModule } from '@/modules/jobs/jobs.module.js';

import { DrizzleHealthChecks } from './health-checks.js';
import { HEALTH_CHECKS } from './ports/health-checks.js';
import { CheckHealthUseCase } from './use-case/check-health.use-case.js';

@Module({
  exports: [CheckHealthUseCase],
  imports: [JobsModule],
  providers: [CheckHealthUseCase, { provide: HEALTH_CHECKS, useClass: DrizzleHealthChecks }],
})
export class HealthModule {}
