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
import { JobConflictError } from '@/modules/jobs/job.errors.js';
import { CancelJobUseCase } from '@/modules/jobs/use-case/cancel-job.use-case.js';
import { CreateAircraftReportJobUseCase } from '@/modules/jobs/use-case/create-aircraft-report-job.use-case.js';
import { CreateEmailJobUseCase } from '@/modules/jobs/use-case/create-email-job.use-case.js';
import { CreateWebhookJobUseCase } from '@/modules/jobs/use-case/create-webhook-job.use-case.js';
import { GetJobUseCase } from '@/modules/jobs/use-case/get-job.use-case.js';

import { CancelledJobDto } from './dtos/cancelled-job.dto.js';
import { CreateAircraftReportJobDto } from './dtos/create-aircraft-report-job.dto.js';
import { CreateEmailJobDto } from './dtos/create-email-job.dto.js';
import { CreateWebhookJobDto } from './dtos/create-webhook-job.dto.js';
import { CreatedJobDto } from './dtos/created-job.dto.js';
import { JobIdDto } from './dtos/job-id.dto.js';
import { JobDto } from './dtos/job.dto.js';

import type { DomainError } from '@/common/errors/domain-error.js';
import type { CreateJobInput } from '@/modules/jobs/job.js';
import type { Result } from 'neverthrow';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly createEmailJob: CreateEmailJobUseCase,
    private readonly createWebhookJob: CreateWebhookJobUseCase,
    private readonly createAircraftReportJob: CreateAircraftReportJobUseCase,
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
    return this.toCreated(await this.createEmailJob.execute(this.toInput(body)));
  }

  @Post('webhook')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue an instant or scheduled webhook job' })
  @ApiBody({ type: CreateWebhookJobDto })
  @ApiEnvelopeResponse(CreatedJobDto.Output, 202)
  @ApiErrorEnvelopeResponse(409, 'The submission key has already been used.')
  async createWebhook(@Body() body: CreateWebhookJobDto): Promise<CreatedJobDto> {
    return this.toCreated(await this.createWebhookJob.execute(this.toInput(body)));
  }

  @Post('aircraft-report')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue an instant or scheduled aircraft transit report job' })
  @ApiBody({ type: CreateAircraftReportJobDto })
  @ApiEnvelopeResponse(CreatedJobDto.Output, 202)
  @ApiErrorEnvelopeResponse(400, 'The schedule or transit request is invalid.')
  @ApiErrorEnvelopeResponse(409, 'The submission key has already been used.')
  async createAircraftReport(@Body() body: CreateAircraftReportJobDto): Promise<CreatedJobDto> {
    return this.toCreated(
      await this.createAircraftReportJob.execute({
        ...this.toInput(body),
        payload: { ...body.payload, departureAt: new Date(body.payload.departureAt) },
      }),
    );
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

  private toInput<TPayload extends object>(body: {
    idempotencyKey: string;
    payload: TPayload;
    priority: number;
    startAt?: string | undefined;
    type: 'instant' | 'schedule';
  }): CreateJobInput<TPayload> {
    return {
      idempotencyKey: body.idempotencyKey,
      payload: body.payload,
      priority: body.priority,
      startAt: body.startAt === undefined ? undefined : new Date(body.startAt),
      type: body.type,
    };
  }

  private toCreated(result: Result<{ id: string; startAt: Date }, DomainError>): CreatedJobDto {
    if (result.isErr()) {
      const response = { code: result.error.name, message: result.error.message };
      if (result.error instanceof JobConflictError) throw new ConflictException(response);
      throw new BadRequestException(response);
    }
    return CreatedJobDto.create({
      id: result.value.id,
      startAt: result.value.startAt.toISOString(),
    });
  }
}
