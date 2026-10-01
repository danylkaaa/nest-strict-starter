import { resolve } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';

import {
  DatabaseConfigSchema,
  readDatabaseConnectionEnv,
} from '@/common/database/database.config.js';
import { DatabaseModule } from '@/common/database/database.module.js';
import { QueueModule } from '@/common/queue/queue.module.js';
import { AircraftTransitsModule } from '@/modules/aircraft-transits/aircraft-transits.module.js';
import { EmailsModule } from '@/modules/emails/emails.module.js';
import { JobsModule } from '@/modules/jobs/jobs.module.js';
import { WebhooksModule } from '@/modules/webhooks/webhooks.module.js';

import { WorkerLoggerModule } from './core/config/worker-logger.module.js';
import { JobHandlerRegistry } from './core/pg-boss/job-handler.registry.js';
import { JobRecoveryService } from './modules/activity-logs/job-recovery.service.js';
import { AircraftReportJobHandler } from './queues/aircraft-report/aircraft-report-job.handler.js';
import { EmailJobHandler } from './queues/email/email-job.handler.js';
import { WebhookJobHandler } from './queues/webhook/webhook-job.handler.js';

import type { DatabaseConfig } from '@/common/database/database.config.js';

function parseWorkerDatabaseConfig(config: ConfigService): DatabaseConfig {
  const read = (key: string): string | undefined => config.get<string>(key);
  return DatabaseConfigSchema.parse(
    readDatabaseConnectionEnv({
      DATABASE_NAME: read('DATABASE_NAME'),
      POSTGRES_HOST: read('POSTGRES_HOST'),
      POSTGRES_PASSWORD: read('POSTGRES_PASSWORD'),
      POSTGRES_PORT: read('POSTGRES_PORT'),
      POSTGRES_USER: read('POSTGRES_USER'),
    }),
  );
}

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: resolve(process.cwd(), '../../.env'), isGlobal: true }),
    DatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => parseWorkerDatabaseConfig(config),
    }),
    QueueModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => parseWorkerDatabaseConfig(config),
    }),
    WorkerLoggerModule,
    DiscoveryModule,
    AircraftTransitsModule,
    EmailsModule,
    JobsModule,
    WebhooksModule,
  ],
  providers: [
    EmailJobHandler,
    WebhookJobHandler,
    AircraftReportJobHandler,
    JobHandlerRegistry,
    JobRecoveryService,
  ],
})
export class WorkerModule {}
