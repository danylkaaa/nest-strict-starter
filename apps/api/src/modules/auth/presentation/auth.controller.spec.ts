import { createMock } from '@golevelup/ts-vitest';
import { err, errAsync, ok, okAsync } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { RequestContext } from '@/app/http/context/request-context.js';
import { AuthService } from '@/modules/auth/application/services/auth.service.js';
import {
  InvalidCredentialsError,
  PasswordVerificationError,
  UserLookupError,
} from '@/modules/auth/domain/auth.errors.js';
import { AuthController } from '@/modules/auth/presentation/auth.controller.js';
import { TokenIssueError } from '@/shared-kernel/auth/token-issuer.port.js';

import type { AuthError } from '@/modules/auth/domain/auth.errors.js';
import type { IssuedToken } from '@/shared-kernel/auth/token-issuer.port.js';

const body = { email: 'ada@example.com', password: 'secret' };

const controllerWith = (login: AuthService['login']) =>
  new AuthController(createMock<AuthService>({ login }), createMock<RequestContext>());

describe('post /auth/login', () => {
  it('returns the token as a bearer response dto', async () => {
    const controller = controllerWith(() =>
      okAsync<IssuedToken, AuthError>({ accessToken: 'jwt', expiresIn: 3600 }),
    );

    expect(await controller.login(body)).toEqual(
      ok({ accessToken: 'jwt', expiresIn: 3600, tokenType: 'Bearer' }),
    );
  });

  it('passes the credentials to the service', async () => {
    const service = createMock<AuthService>({
      login: () => okAsync<IssuedToken, AuthError>({ accessToken: 'jwt', expiresIn: 3600 }),
    });

    await new AuthController(service, createMock<RequestContext>()).login(body);

    expect(service.login).toHaveBeenCalledWith('ada@example.com', 'secret');
  });

  it('maps invalid credentials to a 401 with its name and friendly message', async () => {
    const controller = controllerWith(() => errAsync(new InvalidCredentialsError()));

    const result = await controller.login(body);

    expect(result.mapErr((error) => error.getStatus())).toEqual(err(401));
    expect(result.mapErr((error) => error.getResponse())).toEqual(
      err({ code: 'InvalidCredentialsError', message: 'Email or password is incorrect.' }),
    );
  });

  it.each([new UserLookupError(), new PasswordVerificationError(), new TokenIssueError()])(
    'maps %o to a 500',
    async (error) => {
      const controller = controllerWith(() => errAsync(error));

      const result = await controller.login(body);

      expect(result.mapErr((e) => e.getStatus())).toEqual(err(500));
      expect(result.mapErr((e) => e.getResponse())).toEqual(
        err({ code: error.name, message: error.message }),
      );
    },
  );
});

describe('get /auth/me', () => {
  it('returns the authenticated user', () => {
    const controller = new AuthController(
      createMock<AuthService>(),
      createMock<RequestContext>({ getUser: () => ({ email: 'ada@example.com', id: 'u1' }) }),
    );

    expect(controller.me()).toEqual(ok({ email: 'ada@example.com', id: 'u1' }));
  });
});
