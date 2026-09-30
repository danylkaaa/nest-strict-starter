import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { err, ok, safeTry } from 'neverthrow';

import { PASSWORD_VERIFIER } from '@/modules/auth/application/ports/password-verifier.port.js';
import { USER_REPOSITORY } from '@/modules/auth/application/ports/user-repository.port.js';
import { InvalidCredentialsError } from '@/modules/auth/domain/auth.errors.js';
import { TOKEN_ISSUER } from '@/shared-kernel/auth/token-issuer.port.js';

import type { PasswordVerifier } from '@/modules/auth/application/ports/password-verifier.port.js';
import type { UserRepository } from '@/modules/auth/application/ports/user-repository.port.js';
import type { AuthError } from '@/modules/auth/domain/auth.errors.js';
import type {
  IssuedToken,
  TokenIssueError,
  TokenIssuer,
} from '@/shared-kernel/auth/token-issuer.port.js';
import type { ResultAsync } from 'neverthrow';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_VERIFIER) private readonly passwords: PasswordVerifier,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  /**
   * Unknown email and wrong password both end in the same `InvalidCredentialsError`, after the
   * same amount of hashing work. Never logs the password or the token.
   */
  login(email: string, password: string): ResultAsync<IssuedToken, AuthError | TokenIssueError> {
    const { users, passwords, tokens, logger } = this;
    return safeTry(async function* () {
      const user = yield* users.findByEmail(email);
      const matches = yield* passwords.verify(password, user?.passwordHash ?? null);
      if (!user || !matches) {
        logger.debug('Login rejected');
        return err(new InvalidCredentialsError());
      }
      const token = yield* tokens.issue({ email: user.email, id: user.id });
      logger.info({ userId: user.id }, 'User logged in');
      return ok(token);
    });
  }
}
