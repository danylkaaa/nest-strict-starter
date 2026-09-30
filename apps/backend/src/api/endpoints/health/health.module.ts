import { Module } from '@nestjs/common';

import { HealthModule } from '@/modules/health/health.module.js';

import { HealthController } from './health.controller.js';

@Module({ controllers: [HealthController], imports: [HealthModule] })
export class HealthApiModule {}
