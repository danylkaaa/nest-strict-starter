import { Module } from '@nestjs/common';

import { PASSWORD_VERIFIER } from '@/modules/auth/application/ports/password-verifier.port.js';
import { USER_REPOSITORY } from '@/modules/auth/application/ports/user-repository.port.js';
import { AuthService } from '@/modules/auth/application/services/auth.service.js';
import { DrizzleUserRepository } from '@/modules/auth/infrastructure/drizzle-user.repository.js';
import { ScryptPasswordVerifier } from '@/modules/auth/infrastructure/scrypt-password-verifier.js';
import { AuthController } from '@/modules/auth/presentation/auth.controller.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: USER_REPOSITORY, useClass: DrizzleUserRepository },
    { provide: PASSWORD_VERIFIER, useClass: ScryptPasswordVerifier },
  ],
})
export class AuthModule {}
