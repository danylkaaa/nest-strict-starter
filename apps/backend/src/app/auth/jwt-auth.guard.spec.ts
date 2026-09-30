import { createMock } from '@golevelup/ts-vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JwtAuthGuard } from '@/app/auth/jwt-auth.guard.js';
import { Public } from '@/app/http/auth/public.decorator.js';
import { IS_PUBLIC_KEY } from '@/app/http/auth/public.decorator.js';
import { RequestContext } from '@/app/http/context/request-context.js';

import type { ExecutionContext } from '@nestjs/common';

type FakeRequest = { headers: { authorization?: string } };

const handler = () => undefined;
const makeController = () =>
  class {
    handle() {
      return undefined;
    }
  };
const TestController = makeController();

const contextFor = (request: FakeRequest) =>
  createMock<ExecutionContext>({
    getClass: () => TestController,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  });

describe('jwt auth guard', () => {
  let reflector: Reflector;
  let jwtService: JwtService;
  let requestContext: RequestContext;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = createMock<Reflector>({ getAllAndOverride: () => undefined });
    jwtService = createMock<JwtService>();
    requestContext = createMock<RequestContext>();
    guard = new JwtAuthGuard(reflector, jwtService, requestContext);
  });

  it('lets a public route through without a token', async () => {
    reflector = createMock<Reflector>({ getAllAndOverride: () => true });
    guard = new JwtAuthGuard(reflector, jwtService, requestContext);

    const allowed = await guard.canActivate(contextFor({ headers: {} }));

    expect(allowed).toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(requestContext.setUser).not.toHaveBeenCalled();
  });

  it('looks up the public marker on the handler and then the class', async () => {
    const getAllAndOverride = vi.fn().mockReturnValue(true);
    guard = new JwtAuthGuard(
      createMock<Reflector>({ getAllAndOverride }),
      jwtService,
      requestContext,
    );

    await guard.canActivate(contextFor({ headers: {} }));

    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, TestController]);
  });

  it('lets every route of a class marked @Public() through', async () => {
    const PublicController = makeController();
    Public()(PublicController);
    guard = new JwtAuthGuard(new Reflector(), jwtService, requestContext);
    const context = createMock<ExecutionContext>({
      getClass: () => PublicController,
      getHandler: () => PublicController.prototype.handle,
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    });

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('stores the user in the context from a valid token', async () => {
    jwtService = createMock<JwtService>({
      verifyAsync: () => Promise.resolve({ email: 'ada@example.com', sub: 'u1' }),
    });
    guard = new JwtAuthGuard(reflector, jwtService, requestContext);
    const request: FakeRequest = { headers: { authorization: 'Bearer good.token' } };

    const allowed = await guard.canActivate(contextFor(request));

    expect(allowed).toBe(true);
    expect(requestContext.setUser).toHaveBeenCalledWith({ email: 'ada@example.com', id: 'u1' });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('good.token');
  });

  it.each([
    [undefined],
    [''],
    ['good.token'],
    ['Basic good.token'],
    ['Bearer'],
    ['Bearer '],
    ['Bearer a b'],
    ['bearer good.token'],
  ])('rejects the authorization header %o', async (authorization) => {
    await expect(guard.canActivate(contextFor({ headers: { authorization } }))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(requestContext.setUser).not.toHaveBeenCalled();
  });

  it('rejects with the friendly sign-in message', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toThrow(
      'Please sign in to continue.',
    );
  });

  it('rejects a token that fails verification', async () => {
    jwtService = createMock<JwtService>({
      verifyAsync: () => Promise.reject(new Error('expired')),
    });
    guard = new JwtAuthGuard(reflector, jwtService, requestContext);

    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer bad.token' } })),
    ).rejects.toThrow(UnauthorizedException);
    expect(requestContext.setUser).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ sub: 'u1' }], [{ email: 'a@b.c' }], [{ email: 1, sub: 'u1' }], [[]]])(
    'rejects a malformed payload %o',
    async (payload) => {
      jwtService = createMock<JwtService>({ verifyAsync: () => Promise.resolve(payload) });
      guard = new JwtAuthGuard(reflector, jwtService, requestContext);

      await expect(
        guard.canActivate(contextFor({ headers: { authorization: 'Bearer good.token' } })),
      ).rejects.toThrow(UnauthorizedException);
      expect(requestContext.setUser).not.toHaveBeenCalled();
    },
  );
});
