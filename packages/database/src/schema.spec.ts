import { drizzle } from 'drizzle-orm/node-postgres';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { users } from './schema.js';

vi.mock('ulid', () => ({ ulid: () => '01ARZ3NDEKTSV4RRFFQ69G5FAV' }));

describe('users schema', () => {
  afterEach(() => vi.useRealTimers());

  it('generates a prefixed ulid when inserting a user', () => {
    const query = drizzle
      .mock()
      .insert(users)
      .values({ email: 'ada@example.com', passwordHash: 'hash' })
      .toSQL();

    expect(query.params).toContain('usr_01ARZ3NDEKTSV4RRFFQ69G5FAV');
    expect(query.sql).toContain('"created_at"');
    expect(query.sql).toContain('"updated_at"');
    expect(query.sql).toContain('"password_hash"');
  });

  it('updates the modification timestamp on a drizzle update', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const query = drizzle.mock().update(users).set({ passwordHash: 'new-hash' }).toSQL();

    expect(query.params).toContain(now.toISOString());
  });
});
