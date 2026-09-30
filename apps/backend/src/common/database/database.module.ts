import { Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { createDrizzleInstance } from '@workspace/database/client';

import { createDatabasePool } from './database-pool.js';

import type { DatabaseConfig } from './database.config.js';
import type { DynamicModule, InjectionToken, ModuleMetadata } from '@nestjs/common';

interface DatabaseModuleAsyncOptions<TArgs extends unknown[]> {
  imports?: ModuleMetadata['imports'];
  inject: InjectionToken[];
  useFactory: (...args: TArgs) => DatabaseConfig | Promise<DatabaseConfig>;
}

@Module({})
export class DatabaseModule {
  static forRootAsync<TArgs extends unknown[]>(
    options: DatabaseModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    return {
      exports: [DrizzleModule],
      imports: [
        DrizzleModule.forRootAsync({
          imports: options.imports,
          inject: options.inject,
          useFactory: async (...args: TArgs) => {
            const config = await options.useFactory(...args);
            return {
              db: createDrizzleInstance(createDatabasePool(config)),
            };
          },
        }),
      ],
      module: DatabaseModule,
    };
  }
}
