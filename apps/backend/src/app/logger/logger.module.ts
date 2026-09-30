import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AppConfig } from '@/app/config/app-config.js';
import { createLoggerConfig } from '@/app/logger/logger.config.js';

/**
 * Structured JSON logging with pino (pretty output when `NODE_ENV=development`). Level comes from
 * `AppConfig`. Needs `ConfigModule` and `RequestContextModule`. Import once, in `AppModule`.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => createLoggerConfig(config),
    }),
  ],
})
export class AppLoggerModule {}
