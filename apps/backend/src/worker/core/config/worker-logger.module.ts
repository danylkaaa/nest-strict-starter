import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { z } from 'zod';

@Module({
  exports: [LoggerModule],
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: z
            .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
            .default('info')
            .parse(config.get<string>('logger__level')),
          redact: {
            censor: '[Redacted]',
            paths: [
              'recipient',
              'subject',
              'body',
              'url',
              'payload',
              '*.recipient',
              '*.subject',
              '*.body',
              '*.url',
              '*.payload',
            ],
          },
        },
      }),
    }),
  ],
})
export class WorkerLoggerModule {}
