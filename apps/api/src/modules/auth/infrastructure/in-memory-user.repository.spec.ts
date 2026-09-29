import { ok } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { InMemoryUserRepository } from '@/modules/auth/infrastructure/in-memory-user.repository.js';

describe('in-memory user repository', () => {
  const repository = new InMemoryUserRepository();

  it('finds a user by email', async () => {
    const result = await repository.findByEmail('ada@example.com');

    expect(result).toEqual(ok(expect.objectContaining({ email: 'ada@example.com', id: 'user-1' })));
  });

  it('matches the email case-insensitively', async () => {
    const result = await repository.findByEmail(' Ada@Example.com ');

    expect(result).toEqual(ok(expect.objectContaining({ id: 'user-1' })));
  });

  it('resolves to null for an unknown email', async () => {
    expect(await repository.findByEmail('nobody@example.com')).toEqual(ok(null));
  });

  it.each(['ada@example.com', 'grace@example.com'])(
    'stores a scrypt hash for %s',
    async (email) => {
      const result = await repository.findByEmail(email);

      expect(result).toMatchObject({
        value: { passwordHash: expect.stringMatching(/^scrypt\$/u) },
      });
    },
  );
});
