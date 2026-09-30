import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiEnvelopeResponse } from '@/api/core/swagger/api-envelope-response.js';
import { ListAircraftUseCase } from '@/modules/aircraft-transits/use-case/list-aircraft.use-case.js';

import { AircraftListDto } from './dtos/aircraft.dto.js';

import type { Result } from 'neverthrow';

@ApiTags('aircraft')
@Controller('aircraft')
export class AircraftController {
  constructor(private readonly listAircraft: ListAircraftUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List every seeded aircraft sorted by registration' })
  @ApiEnvelopeResponse(AircraftListDto.Output)
  async list(): Promise<Result<AircraftListDto, never>> {
    const result = await this.listAircraft.execute();
    return result.map((items) => AircraftListDto.create({ items }));
  }
}
