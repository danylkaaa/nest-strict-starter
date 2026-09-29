import { Module } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { LoggerModule } from 'nestjs-pino'

import { AppConfig } from '@/app/config/app-config.js'
import { createLoggerParams } from '@/app/logger/logger.config.js'

/**
 * Structured JSON logging with pino (pretty output when `NODE_ENV=development`). Level comes from
 * `AppConfig`. Needs `ConfigModule` and `RequestContextModule`. Import once, in `AppModule`.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ClsService, AppConfig],
      useFactory: (cls: ClsService, config: AppConfig) => createLoggerParams(cls, config),
    }),
  ],
})
export class AppLoggerModule {}
