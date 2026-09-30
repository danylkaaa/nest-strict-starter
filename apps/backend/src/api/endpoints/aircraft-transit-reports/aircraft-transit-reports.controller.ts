import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { toHttpException } from '@/api/core/errors/to-http-exception.js';
import {
  ApiEnvelopeResponse,
  ApiErrorEnvelopeResponse,
} from '@/api/core/swagger/api-envelope-response.js';
import { GetAircraftTransitReportUseCase } from '@/modules/aircraft-transits/use-case/get-aircraft-transit-report.use-case.js';

import { AircraftTransitReportIdDto } from './dtos/aircraft-transit-report-id.dto.js';
import { AircraftTransitReportDto } from './dtos/aircraft-transit-report.dto.js';

import type { HttpExceptionClass } from '@/api/core/errors/to-http-exception.js';
import type { AircraftTransitReportNotFoundError } from '@/modules/aircraft-transits/use-case/get-aircraft-transit-report.use-case.js';
import type { HttpException } from '@nestjs/common';
import type { Result } from 'neverthrow';

const HTTP_EXCEPTION_FOR = {
  AircraftTransitReportNotFoundError: NotFoundException,
} satisfies Record<AircraftTransitReportNotFoundError['name'], HttpExceptionClass>;

@ApiTags('aircraft-transit-reports')
@Controller('aircraft-transit-reports')
export class AircraftTransitReportsController {
  constructor(private readonly getReport: GetAircraftTransitReportUseCase) {}

  @Get(':id')
  @ApiOperation({
    description:
      'Reports are created by aircraft report jobs; the job result carries the report ID as reportId.',
    summary: 'Get a generated aircraft transit report with its waypoints',
  })
  @ApiEnvelopeResponse(AircraftTransitReportDto.Output)
  @ApiErrorEnvelopeResponse(404, 'The report ID does not exist.')
  async get(
    @Param() params: AircraftTransitReportIdDto,
  ): Promise<Result<AircraftTransitReportDto, HttpException>> {
    const result = await this.getReport.execute({ id: params.id });
    return result
      .map((report) =>
        AircraftTransitReportDto.create({
          aircraft: report.aircraft,
          arrivalAt: report.arrivalAt.toISOString(),
          departureAt: report.departureAt.toISOString(),
          destination: report.destination,
          distanceKm: report.distanceKm,
          durationMinutes: report.durationMinutes,
          id: report.id,
          origin: report.origin,
          waypoints: report.waypoints.map((waypoint) => ({
            altitudeM: waypoint.altitudeM,
            latitude: waypoint.latitude,
            longitude: waypoint.longitude,
            speedKmh: waypoint.speedKmh,
            timestamp: waypoint.timestamp.toISOString(),
          })),
        }),
      )
      .mapErr((error) => toHttpException(error, HTTP_EXCEPTION_FOR));
  }
}
