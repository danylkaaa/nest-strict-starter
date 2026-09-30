import { createMock } from '@golevelup/ts-vitest';
import { err, errAsync, ok, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '@/modules/auth/application/services/auth.service.js';
import {
  InvalidCredentialsError,
  PasswordVerificationError,
  UserLookupError,
} from '@/modules/auth/domain/auth.errors.js';
import { TokenIssueError } from '@/shared-kernel/auth/token-issuer.port.js';

import type { PasswordVerifier } from '@/modules/auth/application/ports/password-verifier.port.js';
import type { UserRepository } from '@/modules/auth/application/ports/user-repository.port.js';
import type { User } from '@/modules/auth/domain/user.js';
import type { TokenIssuer } from '@/shared-kernel/auth/token-issuer.port.js';
import type { PinoLogger } from 'nestjs-pino';

const user: User = { email: 'ada@example.com', id: 'u1', passwordHash: 'hash' };
const token = { accessToken: 'jwt', expiresIn: 3600 };

describe('auth service', () => {
  let users: UserRepository;
  let passwords: PasswordVerifier;
  let tokens: TokenIssuer;
  let logger: PinoLogger;

  const loggedText = () =>
    JSON.stringify([
      vi.mocked(logger.info).mock.calls,
      vi.mocked(logger.debug).mock.calls,
      vi.mocked(logger.warn).mock.calls,
      vi.mocked(logger.error).mock.calls,
    ]);

  const build = () => new AuthService(users, passwords, tokens, logger);

  beforeEach(() => {
    logger = createMock<PinoLogger>();
    users = createMock<UserRepository>({ findByEmail: () => okAsync(user) });
    passwords = createMock<PasswordVerifier>({ verify: () => okAsync(true) });
    tokens = createMock<TokenIssuer>({ issue: () => okAsync(token) });
  });

  it('issues a token for valid credentials', async () => {
    const result = await build().login('ada@example.com', 'secret');

    expect(result).toEqual(ok(token));
    expect(passwords.verify).toHaveBeenCalledWith('secret', 'hash');
    expect(tokens.issue).toHaveBeenCalledWith({ email: 'ada@example.com', id: 'u1' });
  });

  it('logs the login without the password or the token', async () => {
    await build().login('ada@example.com', 'secret');

    expect(logger.info).toHaveBeenCalledWith({ userId: 'u1' }, 'User logged in');
    expect(loggedText()).not.toContain('secret');
    expect(loggedText()).not.toContain('jwt');
  });

  it('does not log the password when credentials are rejected', async () => {
    passwords = createMock<PasswordVerifier>({ verify: () => okAsync(false) });

    await build().login('ada@example.com', 'secret');

    expect(loggedText()).not.toContain('secret');
  });

  it('rejects an unknown email after verifying against no hash', async () => {
    users = createMock<UserRepository>({ findByEmail: () => okAsync(null) });
    passwords = createMock<PasswordVerifier>({ verify: () => okAsync(false) });

    const result = await build().login('nobody@example.com', 'secret');

    expect(result).toEqual(err(new InvalidCredentialsError()));
    expect(passwords.verify).toHaveBeenCalledWith('secret', null);
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with the same error', async () => {
    passwords = createMock<PasswordVerifier>({ verify: () => okAsync(false) });

    const result = await build().login('ada@example.com', 'wrong');

    expect(result).toEqual(err(new InvalidCredentialsError()));
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('passes a lookup failure up', async () => {
    users = createMock<UserRepository>({ findByEmail: () => errAsync(new UserLookupError()) });

    expect(await build().login('ada@example.com', 'secret')).toEqual(err(new UserLookupError()));
  });

  it('passes a verification failure up', async () => {
    passwords = createMock<PasswordVerifier>({
      verify: () => errAsync(new PasswordVerificationError()),
    });

    expect(await build().login('ada@example.com', 'secret')).toEqual(
      err(new PasswordVerificationError()),
    );
  });

  it('passes a token issuer failure up', async () => {
    tokens = createMock<TokenIssuer>({ issue: () => errAsync(new TokenIssueError()) });

    expect(await build().login('ada@example.com', 'secret')).toEqual(err(new TokenIssueError()));
  });
});
