import { ok } from 'neverthrow';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  hashPassword,
  ScryptPasswordVerifier,
} from '@/modules/auth/infrastructure/scrypt-password-verifier.js';

describe('scrypt password verifier', () => {
  const verifier = new ScryptPasswordVerifier();
  let hash: string;

  beforeAll(async () => {
    hash = await hashPassword('correct horse');
  });

  it('accepts the password that produced the hash', async () => {
    expect(await verifier.verify('correct horse', hash)).toEqual(ok(true));
  });

  it('rejects a wrong password', async () => {
    expect(await verifier.verify('wrong horse', hash)).toEqual(ok(false));
  });

  it('salts each hash differently', async () => {
    expect(await hashPassword('correct horse')).not.toBe(hash);
  });

  it.each(['', 'plaintext', 'scrypt$abc', 'scrypt$abc$def', 'bcrypt$aa$bb', 'scrypt$aa$bb$cc'])(
    'rejects against the malformed hash %o',
    async (malformed) => {
      expect(await verifier.verify('correct horse', malformed)).toEqual(ok(false));
    },
  );

  it('resolves to false when there is no hash', async () => {
    expect(await verifier.verify('correct horse', null)).toEqual(ok(false));
  });
});
