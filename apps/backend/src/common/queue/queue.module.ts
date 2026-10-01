import { Global, Module } from '@nestjs/common';

import { QueueService } from './queue.service.js';

import type { QueueConnection } from './queue.service.js';
import type { DynamicModule, InjectionToken } from '@nestjs/common';

@Global()
@Module({})
export class QueueModule {
  static forRootAsync(options: {
    imports?: DynamicModule['imports'];
    inject: InjectionToken[];
    useFactory: (...args: never[]) => QueueConnection;
  }): DynamicModule {
    return {
      exports: [QueueService],
      imports: options.imports,
      module: QueueModule,
      providers: [
        {
          inject: options.inject,
          provide: QueueService,
          useFactory: (...args: never[]) => new QueueService(options.useFactory(...args)),
        },
      ],
    };
  }
}
