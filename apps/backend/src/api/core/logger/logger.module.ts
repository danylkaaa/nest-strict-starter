import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { ApiConfig } from '@/api/core/config/api.config.js';

import { createLoggerConfig } from './logger.config.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ApiConfig],
      useFactory: (config: ApiConfig) => createLoggerConfig(config),
    }),
  ],
})
export class AppLoggerModule {}
