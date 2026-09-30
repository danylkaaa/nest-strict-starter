import { TransactionHost } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';

import { PostgresUnavailableError } from '@/modules/health/domain/health.errors.js';

import type { PostgresHealthProbePort } from '@/modules/health/application/ports/postgres-health-probe.port.js';
import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import type { Database } from '@workspace/database/client';

@Injectable()
export class PostgresHealthProbe implements PostgresHealthProbePort {
  constructor(
    @Inject(TransactionHost) private readonly host: Pick<
      TransactionHost<TransactionalAdapterDrizzleOrm<Database>>,
      'tx'
    >,
  ) {}

  check(): ResultAsync<true, PostgresUnavailableError> {
    return ResultAsync.fromPromise(
      this.host.tx.execute(sql`SELECT 1`),
      () => new PostgresUnavailableError(),
    ).map((): true => true);
  }
}
