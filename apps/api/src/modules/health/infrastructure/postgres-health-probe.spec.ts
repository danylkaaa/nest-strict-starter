import { createDatabase } from '@workspace/database/client';
import { err, ok } from 'neverthrow';
import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { PostgresUnavailableError } from '@/modules/health/domain/health.errors.js';
import { PostgresHealthProbe } from '@/modules/health/infrastructure/postgres-health-probe.js';

describe('postgres health probe', () => {
  it('reports success when PostgreSQL accepts a query', async () => {
    const database = createDatabase(new Pool());
    vi.spyOn(database, 'execute').mockResolvedValue({
      command: 'SELECT',
      fields: [],
      oid: 0,
      rowCount: 1,
      rows: [{ healthy: 1 }],
    });
    const host = { tx: database };

    expect(await new PostgresHealthProbe(host).check()).toEqual(ok(true));
  });

  it('maps connection or query failures to a friendly error', async () => {
    const database = createDatabase(new Pool());
    vi.spyOn(database, 'execute').mockRejectedValue(
      new Error('secret database connection details'),
    );
    const host = { tx: database };

    expect(await new PostgresHealthProbe(host).check()).toEqual(
      err(new PostgresUnavailableError()),
    );
  });
});
