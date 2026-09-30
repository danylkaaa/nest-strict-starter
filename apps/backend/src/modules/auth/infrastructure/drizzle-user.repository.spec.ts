import { createDatabase } from '@workspace/database/client';
import { users } from '@workspace/database/schema';
import { eq } from 'drizzle-orm';
import { err, ok } from 'neverthrow';
import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { UserLookupError } from '@/modules/auth/domain/auth.errors.js';
import { DrizzleUserRepository } from '@/modules/auth/infrastructure/drizzle-user.repository.js';

describe('drizzle user repository', () => {
  it('normalizes the email and returns only authentication fields from the database row', async () => {
    const database = createDatabase(new Pool());
    const findFirst = vi.spyOn(database.query.users, 'findFirst').mockResolvedValue({
      createdAt: new Date('2026-01-01'),
      email: 'ada@example.com',
      id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      passwordHash: 'database-password-hash',
      updatedAt: new Date('2026-01-01'),
    });

    const result = await new DrizzleUserRepository({ tx: database }).findByEmail(
      ' Ada@Example.com ',
    );

    expect(result).toEqual(
      ok({
        email: 'ada@example.com',
        id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        passwordHash: 'database-password-hash',
      }),
    );
    expect(findFirst).toHaveBeenCalledWith({
      columns: { email: true, id: true, passwordHash: true },
      where: eq(users.email, 'ada@example.com'),
    });
  });

  it('returns null when the email is absent from the database', async () => {
    const database = createDatabase(new Pool());
    vi.spyOn(database.query.users, 'findFirst').mockResolvedValue(undefined);

    expect(
      await new DrizzleUserRepository({ tx: database }).findByEmail('nobody@example.com'),
    ).toEqual(ok(null));
  });

  it('maps database failure to a safe lookup error', async () => {
    const database = createDatabase(new Pool());
    vi.spyOn(database.query.users, 'findFirst').mockRejectedValue(
      new Error('secret connection credentials'),
    );

    expect(
      await new DrizzleUserRepository({ tx: database }).findByEmail('admin@example.com'),
    ).toEqual(err(new UserLookupError()));
  });
});
