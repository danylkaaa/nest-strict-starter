import { Module } from '@nestjs/common';
import { dotenvLoader, TypedConfigModule } from 'nest-typed-config';

import { AppConfig, AppConfigSchema } from '@/app/config/app-config.js';

/**
 * Loads `.env` plus the process environment, validates it with zod at startup (the app refuses to
 * boot on invalid config) and provides `AppConfig` globally. Import once, in `AppModule`.
 */
@Module({
  imports: [
    TypedConfigModule.forRoot({
      load: dotenvLoader(),
      schema: AppConfig,
      validate: (raw) => AppConfigSchema.parse(raw),
    }),
  ],
})
export class ConfigModule {}
