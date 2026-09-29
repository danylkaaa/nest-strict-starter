import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ResultAsync } from 'neverthrow';

import { PasswordVerificationError } from '@/modules/auth/domain/auth.errors.js';

import type { PasswordVerifier } from '@/modules/auth/application/ports/password-verifier.port.js';

const KEY_LENGTH = 64;

// Verified when the user is unknown so that path costs the same as a wrong password.
const DUMMY_HASH =
  'scrypt$3af51b335d5bff25851c7de65c696cc9$db347beb6d6bd05da01286197f55341ce57d844237c3b812b90cea456028844b2425b3f812169942800f453cdb928d2208486be62e09d30a3e9592c448cf67fd';

const derive = (plain: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(plain, salt, KEY_LENGTH, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });

/** Hashes a password as `scrypt$<salt hex>$<hash hex>`. Used to create the stored hashes. */
export const hashPassword = async (plain: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await derive(plain, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
};

const verifyHash = async (plain: string, hash: string): Promise<boolean> => {
  const [scheme, saltHex, keyHex, ...rest] = hash.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex || rest.length > 0) {
    return false;
  }
  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== KEY_LENGTH) {
    return false;
  }
  const actual = await derive(plain, Buffer.from(saltHex, 'hex'));
  return timingSafeEqual(actual, expected);
};

@Injectable()
export class ScryptPasswordVerifier implements PasswordVerifier {
  verify(plain: string, hash: string | null): ResultAsync<boolean, PasswordVerificationError> {
    return ResultAsync.fromPromise(
      verifyHash(plain, hash ?? DUMMY_HASH).then((matches) => matches && hash !== null),
      () => new PasswordVerificationError(),
    );
  }
}
