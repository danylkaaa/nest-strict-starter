import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiEnvelopeResponse,
  ApiErrorEnvelopeResponse,
} from '@/api/core/swagger/api-envelope-response.js';
import { CheckHealthUseCase } from '@/modules/health/use-case/check-health.use-case.js';

import { HealthDto } from './dtos/health.dto.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly checkHealth: CheckHealthUseCase) {}

  @Get()
  @ApiOperation({
    description:
      'Checks the database and the queue (2 second timeout each) and returns the job counts. Counts are zero while the database is down. When a check fails the response is 503 and the same report is in error.details.',
    summary: 'Report whether the database and queue answer',
  })
  @ApiEnvelopeResponse(HealthDto.Output)
  @ApiErrorEnvelopeResponse(503, 'The database or the queue does not answer.')
  async health(): Promise<HealthDto> {
    const report = await this.checkHealth.execute();
    if (report.status === 'ok') return HealthDto.create(report);
    const failed = Object.entries(report.checks)
      .filter(([, state]) => state === 'down')
      .map(([name]) => name);
    throw new ServiceUnavailableException({
      code: 'SERVICE_UNAVAILABLE',
      details: { checks: report.checks, counts: report.counts, status: report.status },
      message: `A dependency is not answering: ${failed.join(', ')}.`,
    });
  }
}
