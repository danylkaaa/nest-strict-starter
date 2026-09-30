import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, registerAs } from '@nestjs/config';

import { ApiConfig, parseApiConfig } from '@/api/core/config/api.config';

const apiConfiguration = registerAs('config', () => parseApiConfig(process.env));

@Global()
@Module({
  exports: [ApiConfig],
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [apiConfiguration],
    }),
  ],
  providers: [
    {
      inject: [apiConfiguration.KEY],
      provide: ApiConfig,
      useFactory: (config: ApiConfig) => config,
    },
  ],
})
export class ConfigModule {}
