import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';

import { IS_PUBLIC_KEY } from '@/app/http/auth/public.decorator.js';
import { RequestContext } from '@/app/http/context/request-context.js';

import type { CanActivate, ExecutionContext } from '@nestjs/common';

type AuthRequest = { headers: { authorization?: string } };

const UNAUTHORIZED_MESSAGE = 'Please sign in to continue.';

const TokenPayloadSchema = z.object({ email: z.string().min(1), sub: z.string().min(1) });

const extractBearerToken = (header: string | undefined): string | undefined => {
  const [scheme, token, ...rest] = (header ?? '').split(' ');
  return scheme === 'Bearer' && token && rest.length === 0 ? token : undefined;
};

/**
 * Global guard (registered once by `AuthWiringModule`): every route needs a valid Bearer token
 * unless the handler or controller is marked `@Public()`. Any failure is a 401 `UNAUTHORIZED`.
 * On success the user is stored through `RequestContext.setUser`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly requestContext: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const payload = await this.jwtService.verifyAsync<object>(token).catch(() => {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    });
    const parsed = TokenPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    this.requestContext.setUser({ email: parsed.data.email, id: parsed.data.sub });
    return true;
  }
}
