import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiEnvelopeResponse } from '@/api/core/swagger/api-envelope-response.js';
import { ListAirportsUseCase } from '@/modules/aircraft-transits/use-case/list-airports.use-case.js';

import { AirportsDto } from './dtos/airport.dto.js';

import type { Result } from 'neverthrow';

@ApiTags('airports')
@Controller('airports')
export class AirportsController {
  constructor(private readonly listAirports: ListAirportsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List every seeded airport sorted by ICAO code' })
  @ApiEnvelopeResponse(AirportsDto.Output)
  async list(): Promise<Result<AirportsDto, never>> {
    const result = await this.listAirports.execute();
    return result.map((items) => AirportsDto.create({ items }));
  }
}
