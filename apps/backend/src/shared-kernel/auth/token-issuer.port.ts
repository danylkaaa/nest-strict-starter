import { DomainError } from '@/app/base/domain-error.js';

import type { AuthenticatedUser } from '@/shared-kernel/auth/authenticated-user.js';
import type { ResultAsync } from 'neverthrow';

export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

export type IssuedToken = { accessToken: string; expiresIn: number };

export class TokenIssueError extends DomainError {
  override readonly name = 'TokenIssueError';
  constructor(message = 'We could not sign you in. Please try again.') {
    super(message);
  }
}

/** Implemented in `app/auth/` (JWT), consumed by `modules/auth/`. */
export interface TokenIssuer {
  issue(user: AuthenticatedUser): ResultAsync<IssuedToken, TokenIssueError>;
}
