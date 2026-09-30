import { scryptSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createDefaultUser } from './default-user.js';

describe('default user seed', () => {
  it('hashes the requested password using the API scrypt format', async () => {
    const user = await createDefaultUser();
    const salt = user.passwordHash.slice(7, 39);
    const hash = user.passwordHash.slice(40);

    expect(user.email).toBe('admin@example.com');
    expect(user.passwordHash).toMatch(/^scrypt\$[\da-f]{32}\$[\da-f]{128}$/u);
    expect(scryptSync('12345678', Buffer.from(salt, 'hex'), 64).toString('hex')).toBe(hash);
    expect(scryptSync('incorrect', Buffer.from(salt, 'hex'), 64).toString('hex')).not.toBe(hash);
  });

  it('uses a fresh salt each time', async () => {
    const first = await createDefaultUser();
    const second = await createDefaultUser();

    expect(first.passwordHash).not.toBe(second.passwordHash);
  });
});
