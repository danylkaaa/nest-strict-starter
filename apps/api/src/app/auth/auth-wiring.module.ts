import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { JwtAuthGuard } from '@/app/auth/jwt-auth.guard.js';
import { JwtTokenIssuer } from '@/app/auth/jwt-token-issuer.js';
import { AppConfig } from '@/app/config/app-config.js';
import { TOKEN_ISSUER } from '@/shared-kernel/auth/token-issuer.port.js';

/**
 * Registers JWT verification (global guard) and the token-issuer port implementation.
 * Import once, in `AppModule`, after `ConfigModule`.
 */
@Global()
@Module({
  exports: [TOKEN_ISSUER],
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({ secret: config.JWT_SECRET }),
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
  ],
})
export class AuthWiringModule {}
