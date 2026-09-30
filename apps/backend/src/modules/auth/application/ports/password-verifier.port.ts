import type { PasswordVerificationError } from '@/modules/auth/domain/auth.errors.js';
import type { ResultAsync } from 'neverthrow';

export const PASSWORD_VERIFIER = Symbol('PASSWORD_VERIFIER');

export interface PasswordVerifier {
  /**
   * Resolves to whether `plain` matches `hash`. A `null` hash (unknown user) still costs a full
   * verification and resolves to `false`, so both failure paths take the same time.
   */
  verify(plain: string, hash: string | null): ResultAsync<boolean, PasswordVerificationError>;
}
