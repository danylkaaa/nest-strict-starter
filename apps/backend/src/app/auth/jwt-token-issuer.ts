import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ResultAsync } from 'neverthrow';

import { AppConfig } from '@/app/config/app-config.js';
import { TokenIssueError } from '@/shared-kernel/auth/token-issuer.port.js';

import type { AuthenticatedUser } from '@/shared-kernel/auth/authenticated-user.js';
import type { IssuedToken, TokenIssuer } from '@/shared-kernel/auth/token-issuer.port.js';

/** `TokenIssuer` backed by `JwtService`. The payload holds only `sub` (user id) and `email`. */
@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfig,
  ) {}

  issue(user: AuthenticatedUser): ResultAsync<IssuedToken, TokenIssueError> {
    const expiresIn = this.config.JWT_EXPIRES_IN;
    return ResultAsync.fromPromise(
      this.jwtService.signAsync({ email: user.email, sub: user.id }, { expiresIn }),
      () => new TokenIssueError(),
    ).map((accessToken) => ({ accessToken, expiresIn }));
  }
}
