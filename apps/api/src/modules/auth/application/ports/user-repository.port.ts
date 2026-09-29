import type { UserLookupError } from '@/modules/auth/domain/auth.errors.js';
import type { User } from '@/modules/auth/domain/user.js';
import type { ResultAsync } from 'neverthrow';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  /** Resolves to `null` when no user has this email. */
  findByEmail(email: string): ResultAsync<User | null, UserLookupError>;
}
