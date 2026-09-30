import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';

import { POSTGRES_HEALTH_PROBE } from '@/modules/health/application/ports/postgres-health-probe.port.js';
import { HealthResponseDto } from '@/modules/health/presentation/dtos/health-response.dto.js';

import type { PostgresHealthProbePort } from '@/modules/health/application/ports/postgres-health-probe.port.js';
import type { HttpException } from '@nestjs/common';
import type { ResultAsync } from 'neverthrow';

@Controller('health')
export class HealthController {
  constructor(@Inject(POSTGRES_HEALTH_PROBE) private readonly probe: PostgresHealthProbePort) {}

  @Get()
  check(): ResultAsync<HealthResponseDto, HttpException> {
    return this.probe
      .check()
      .map(() => HealthResponseDto.create({ postgres: 'up', status: 'ok' }))
      .mapErr(
        (error) => new ServiceUnavailableException({ code: error.name, message: error.message }),
      );
  }
}
