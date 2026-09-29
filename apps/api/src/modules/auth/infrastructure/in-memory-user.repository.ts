import { Injectable } from '@nestjs/common';
import { okAsync } from 'neverthrow';

import type { UserRepository } from '@/modules/auth/application/ports/user-repository.port.js';
import type { UserLookupError } from '@/modules/auth/domain/auth.errors.js';
import type { User } from '@/modules/auth/domain/user.js';
import type { ResultAsync } from 'neverthrow';

// Development users. Passwords are scrypt hashes (`scrypt$<salt hex>$<hash hex>`), never plaintext;
// the dev credentials are listed in `apps/api/AGENTS.md`.
const USERS: readonly User[] = [
  {
    email: 'ada@example.com',
    id: 'user-1',
    passwordHash:
      'scrypt$b31dfe18191f124716c3f5622bbbdcbd$78e422eba2cc8a736338e7e4a2da66d13e9dddb460c4aec71f85f610ce825c043bade112ea394eed18af925020dc199699e44d13d7967b1a259746c02974e712',
  },
  {
    email: 'grace@example.com',
    id: 'user-2',
    passwordHash:
      'scrypt$e7e0d8c575246bebf437ecd1dfd6427a$7070cf817a797aa0f4ad070bd1b751e4a9cb70f73513f7e6038000209f86dbef50a296c283e8d79b6348ed487dc18a737453e0f5ce81bbfe276b54916e5c5e6e',
  },
];

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  findByEmail(email: string): ResultAsync<User | null, UserLookupError> {
    const normalized = email.trim().toLowerCase();
    return okAsync(USERS.find((user) => user.email === normalized) ?? null);
  }
}
