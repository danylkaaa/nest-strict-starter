import { TransactionHost } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';
import { users } from '@workspace/database/schema';
import { eq } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';

import { UserLookupError } from '@/modules/auth/domain/auth.errors.js';

import type { UserRepository } from '@/modules/auth/application/ports/user-repository.port.js';
import type { User } from '@/modules/auth/domain/user.js';
import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import type { Database } from '@workspace/database/client';

@Injectable()
export class DrizzleUserRepository implements UserRepository {
  constructor(
    @Inject(TransactionHost) private readonly host: Pick<
      TransactionHost<TransactionalAdapterDrizzleOrm<Database>>,
      'tx'
    >,
  ) {}

  findByEmail(email: string): ResultAsync<User | null, UserLookupError> {
    return ResultAsync.fromPromise(
      this.host.tx.query.users.findFirst({
        columns: { email: true, id: true, passwordHash: true },
        where: eq(users.email, email.trim().toLowerCase()),
      }),
      () => new UserLookupError(),
    ).map((user) =>
      user ? { email: user.email, id: user.id, passwordHash: user.passwordHash } : null,
    );
  }
}
