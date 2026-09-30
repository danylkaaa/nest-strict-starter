import { createMock } from '@golevelup/ts-vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { err, errAsync, ok, okAsync } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { PostgresUnavailableError } from '@/modules/health/domain/health.errors.js';
import { HealthController } from '@/modules/health/presentation/health.controller.js';

import type { PostgresHealthProbePort } from '@/modules/health/application/ports/postgres-health-probe.port.js';

describe('health controller', () => {
  it('reports PostgreSQL up after a successful probe', async () => {
    const probe = createMock<PostgresHealthProbePort>({
      check: () => okAsync<true, PostgresUnavailableError>(true),
    });

    expect(await new HealthController(probe).check()).toEqual(ok({ postgres: 'up', status: 'ok' }));
  });

  it('maps an unavailable PostgreSQL connection to 503', async () => {
    const failure = new PostgresUnavailableError();
    const probe = createMock<PostgresHealthProbePort>({
      check: () => errAsync<true, PostgresUnavailableError>(failure),
    });

    expect(await new HealthController(probe).check()).toEqual(
      err(new ServiceUnavailableException({ code: failure.name, message: failure.message })),
    );
  });
});
