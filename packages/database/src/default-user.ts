import { randomBytes, scrypt } from 'node:crypto';

/** Matches the API verifier's scrypt$<salt hex>$<64-byte key hex> format. */
export async function createDefaultUser() {
  const salt = randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt('12345678', salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });

  return {
    email: 'admin@example.com',
    passwordHash: `scrypt$${salt.toString('hex')}$${key.toString('hex')}`,
  };
}
