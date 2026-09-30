import { Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { createDatabase } from '@workspace/database/client';
import { PinoLogger } from 'nestjs-pino';

import { AppConfig } from '@/app/config/app-config.js';

import { createDatabasePool } from './database-pool.js';

@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [AppConfig, PinoLogger],
      useFactory: (config: AppConfig, logger: PinoLogger) => ({
        db: createDatabase(createDatabasePool(config, logger)),
      }),
    }),
  ],
})
export class DatabaseModule {}
