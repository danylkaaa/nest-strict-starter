import { resolve } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';

import { DatabaseConfigSchema } from '@/common/database/database.config.js';
import { DatabaseModule } from '@/common/database/database.module.js';
import { QueueModule } from '@/common/queue/queue.module.js';
import { EmailsModule } from '@/modules/emails/emails.module.js';
import { JobsModule } from '@/modules/jobs/jobs.module.js';

import { WorkerLoggerModule } from './core/config/worker-logger.module.js';
import { JobHandlerRegistry } from './core/pg-boss/job-handler.registry.js';
import { JobRecoveryService } from './modules/activity-logs/job-recovery.service.js';
import { EmailJobHandler } from './queues/email/email-job.handler.js';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: resolve(process.cwd(), '../../.env'), isGlobal: true }),
    DatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        DatabaseConfigSchema.parse({ url: config.getOrThrow<string>('DATABASE_URL') }),
    }),
    QueueModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getOrThrow<string>('DATABASE_URL'),
    }),
    WorkerLoggerModule,
    DiscoveryModule,
    EmailsModule,
    JobsModule,
  ],
  providers: [EmailJobHandler, JobHandlerRegistry, JobRecoveryService],
})
export class WorkerModule {}
