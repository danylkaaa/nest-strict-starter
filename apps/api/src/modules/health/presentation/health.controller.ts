import { Controller, Get } from '@nestjs/common';
import { ok } from 'neverthrow';

import { HealthResponseDto } from '@/modules/health/presentation/dtos/health-response.dto.js';

import type { HttpError } from '@/app/http/errors/http-errors.js';
import type { Result } from 'neverthrow';

@Controller('health')
export class HealthController {
  @Get()
  check(): Result<HealthResponseDto, HttpError> {
    return ok(HealthResponseDto.create({ status: 'ok' }));
  }
}
