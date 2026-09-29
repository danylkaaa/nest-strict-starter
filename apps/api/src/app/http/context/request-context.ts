import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type { AuthenticatedUser } from '@/shared-kernel/auth/authenticated-user.js';

const USER_KEY = 'user';

/**
 * The one global per-request context, a typed wrapper around `ClsService` (nestjs-cls, no second
 * AsyncLocalStorage). Every per-request value gets its own method here. The global JWT guard calls
 * `setUser`; controllers call `getUser` and pass the user to services as an argument, because
 * services never read request context. `getUser` throws when nothing was set: a programming error
 * (a `@Public()` route or code running outside a request), never an expected failure.
 */
@Injectable()
export class RequestContext {
  constructor(private readonly cls: ClsService) {}

  setUser(user: AuthenticatedUser): void {
    this.cls.set(USER_KEY, user);
  }

  getUser(): AuthenticatedUser {
    const user = this.cls.isActive()
      ? this.cls.get<AuthenticatedUser | undefined>(USER_KEY)
      : undefined;
    if (!user) {
      throw new Error(
        'No authenticated user in the context: is this a @Public() route or outside a request?',
      );
    }
    return user;
  }
}
