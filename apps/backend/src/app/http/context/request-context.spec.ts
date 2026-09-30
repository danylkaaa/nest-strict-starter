import { AsyncLocalStorage } from 'node:async_hooks';

import { ClsService } from 'nestjs-cls';
import { beforeEach, describe, expect, it } from 'vitest';

import { RequestContext } from '@/app/http/context/request-context.js';

describe('request context', () => {
  let cls: ClsService;
  let context: RequestContext;

  beforeEach(() => {
    cls = new ClsService(new AsyncLocalStorage());
    context = new RequestContext(cls);
  });

  it('returns the user that was set in the same context', () => {
    const user = { email: 'ada@example.com', id: 'u1' };

    const result = cls.run(() => {
      context.setUser(user);
      return context.getUser();
    });

    expect(result).toEqual(user);
  });

  it('throws when no user was set', () => {
    expect(() => cls.run(() => context.getUser())).toThrow('No authenticated user in the context');
  });

  it('throws outside of any context', () => {
    expect(() => context.getUser()).toThrow('No authenticated user in the context');
  });
});
