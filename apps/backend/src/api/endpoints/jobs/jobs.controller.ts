import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiEnvelopeResponse,
  ApiErrorEnvelopeResponse,
} from '@/api/core/swagger/api-envelope-response.js';
import { JobConflictError } from '@/modules/jobs/job.errors';
import { CancelJobUseCase } from '@/modules/jobs/use-case/cancel-job.use-case.js';
import { CreateEmailJobUseCase } from '@/modules/jobs/use-case/create-email-job.use-case.js';
import { GetJobUseCase } from '@/modules/jobs/use-case/get-job.use-case.js';

import { CancelledJobDto } from './dtos/cancelled-job.dto.js';
import { CreateEmailJobDto } from './dtos/create-email-job.dto.js';
import { CreatedJobDto } from './dtos/created-job.dto.js';
import { JobIdDto } from './dtos/job-id.dto.js';
import { JobDto } from './dtos/job.dto.js';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly createJob: CreateEmailJobUseCase,
    private readonly getJob: GetJobUseCase,
    private readonly cancelJob: CancelJobUseCase,
  ) {}

  @Post('email')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue an instant or scheduled email job' })
  @ApiBody({ type: CreateEmailJobDto })
  @ApiEnvelopeResponse(CreatedJobDto.Output, 202)
  @ApiErrorEnvelopeResponse(409, 'The submission key has already been used.')
  async create(@Body() body: CreateEmailJobDto): Promise<CreatedJobDto> {
    const result = await this.createJob.execute({
      idempotencyKey: body.idempotencyKey,
      payload: body.payload,
      priority: body.priority,
      startAt: body.startAt === undefined ? undefined : new Date(body.startAt),
      type: body.type,
    });
    if (result.isErr()) {
      if (result.error instanceof JobConflictError) {
        throw new ConflictException({ code: result.error.name, message: result.error.message });
      }

      throw new BadRequestException({ code: result.error.name, message: result.error.message });
    }
    return CreatedJobDto.create({
      id: result.value.id,
      startAt: result.value.startAt.toISOString(),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job status and ordered activity' })
  @ApiEnvelopeResponse(JobDto.Output)
  @ApiErrorEnvelopeResponse(404, 'The job ID does not exist.')
  async get(@Param() params: JobIdDto): Promise<JobDto> {
    const result = await this.getJob.execute(params.id);
    if (result.isErr())
      throw new NotFoundException({ code: result.error.name, message: result.error.message });
    return JobDto.create({
      activity: result.value.activity.map((event) => ({
        attempt: event.attempt,
        errorCategory: event.errorCategory,
        event: event.event,
        id: event.id,
        recordedAt: event.recordedAt.toISOString(),
      })),
      id: result.value.id,
      priority: result.value.priority,
      result: result.value.result,
      startAt: result.value.startAt.toISOString(),
      status: result.value.status,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a pending or scheduled job' })
  @ApiEnvelopeResponse(CancelledJobDto.Output)
  @ApiErrorEnvelopeResponse(404, 'The job ID does not exist.')
  @ApiErrorEnvelopeResponse(409, 'The job is already processing or terminal.')
  async cancel(@Param() params: JobIdDto): Promise<CancelledJobDto> {
    const result = await this.cancelJob.execute(params.id);
    if (result.isErr()) {
      if (result.error.name === 'JobNotFoundError')
        throw new NotFoundException({ code: result.error.name, message: result.error.message });
      throw new ConflictException({ code: result.error.name, message: result.error.message });
    }
    return CancelledJobDto.create(result.value);
  }
}
