import { Module } from '@nestjs/common';

import { PASSWORD_VERIFIER } from '@/modules/auth/application/ports/password-verifier.port.js';
import { USER_REPOSITORY } from '@/modules/auth/application/ports/user-repository.port.js';
import { AuthService } from '@/modules/auth/application/services/auth.service.js';
import { InMemoryUserRepository } from '@/modules/auth/infrastructure/in-memory-user.repository.js';
import { ScryptPasswordVerifier } from '@/modules/auth/infrastructure/scrypt-password-verifier.js';
import { AuthController } from '@/modules/auth/presentation/auth.controller.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
    { provide: PASSWORD_VERIFIER, useClass: ScryptPasswordVerifier },
  ],
})
export class AuthModule {}
