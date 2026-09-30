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
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiEnvelopeResponse,
  ApiErrorEnvelopeResponse,
} from '@/api/core/swagger/api-envelope-response.js';
import { JobConflictError, JobNotFoundError } from '@/modules/jobs/job.errors.js';
import { CancelJobUseCase } from '@/modules/jobs/use-case/cancel-job.use-case.js';
import { CreateAircraftReportJobUseCase } from '@/modules/jobs/use-case/create-aircraft-report-job.use-case.js';
import { CreateEmailJobUseCase } from '@/modules/jobs/use-case/create-email-job.use-case.js';
import { CreateWebhookJobUseCase } from '@/modules/jobs/use-case/create-webhook-job.use-case.js';
import { GetJobStatsUseCase } from '@/modules/jobs/use-case/get-job-stats.use-case.js';
import { GetJobUseCase } from '@/modules/jobs/use-case/get-job.use-case.js';
import { ListJobsUseCase } from '@/modules/jobs/use-case/list-jobs.use-case.js';
import { RetryJobUseCase } from '@/modules/jobs/use-case/retry-job.use-case.js';

import { CancelledJobDto } from './dtos/cancelled-job.dto.js';
import { CreateAircraftReportJobDto } from './dtos/create-aircraft-report-job.dto.js';
import { CreateEmailJobDto } from './dtos/create-email-job.dto.js';
import { CreateWebhookJobDto } from './dtos/create-webhook-job.dto.js';
import { CreatedJobDto } from './dtos/created-job.dto.js';
import { JobIdDto } from './dtos/job-id.dto.js';
import { JobStatsDto } from './dtos/job-stats.dto.js';
import { toJobSummaryResponse } from './dtos/job-summary.schema.js';
import { JobDto } from './dtos/job.dto.js';
import { JobsPageDto } from './dtos/jobs-page.dto.js';
import { ListJobsDto } from './dtos/list-jobs.dto.js';

import type { DomainError } from '@/common/errors/domain-error.js';
import type { CreateJobInput, Job } from '@/modules/jobs/job.js';
import type { Result } from 'neverthrow';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly createEmailJob: CreateEmailJobUseCase,
    private readonly createWebhookJob: CreateWebhookJobUseCase,
    private readonly createAircraftReportJob: CreateAircraftReportJobUseCase,
    private readonly getJob: GetJobUseCase,
    private readonly listJobs: ListJobsUseCase,
    private readonly getJobStats: GetJobStatsUseCase,
    private readonly cancelJob: CancelJobUseCase,
    private readonly retryJob: RetryJobUseCase,
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

  @Get()
  @ApiOperation({
    description:
      'Newest first (createdAt, then id, descending). A scheduled job whose start time has passed is listed and filtered as pending.',
    summary: 'List jobs with filters and pagination',
  })
  @ApiEnvelopeResponse(JobsPageDto.Output)
  async list(@Query() query: ListJobsDto): Promise<JobsPageDto> {
    const page = await this.listJobs.execute({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.queue === undefined ? {} : { queue: query.queue }),
      ...(query.search === undefined || query.search === '' ? {} : { search: query.search }),
      ...(query.status === undefined ? {} : { statuses: query.status }),
    });
    return JobsPageDto.create({
      items: page.items.map((job) => toJobSummaryResponse(job)),
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Count jobs per status and report whether the database and queue answer',
  })
  @ApiEnvelopeResponse(JobStatsDto.Output)
  async stats(): Promise<JobStatsDto> {
    return JobStatsDto.create(await this.getJobStats.execute());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job status and ordered activity' })
  @ApiEnvelopeResponse(JobDto.Output)
  @ApiErrorEnvelopeResponse(404, 'The job ID does not exist.')
  async get(@Param() params: JobIdDto): Promise<JobDto> {
    const result = await this.getJob.execute(params.id);
    if (result.isErr())
      throw new NotFoundException({ code: result.error.name, message: result.error.message });
    return this.toJobDto(result.value);
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ApiOperation({
    description:
      'Grants one more attempt: the job becomes pending again, its maxAttempts rises by one, and a retried activity event is recorded.',
    summary: 'Retry a failed job',
  })
  @ApiEnvelopeResponse(JobDto.Output)
  @ApiErrorEnvelopeResponse(404, 'The job ID does not exist.')
  @ApiErrorEnvelopeResponse(409, 'The job has not failed.')
  async retry(@Param() params: JobIdDto): Promise<JobDto> {
    const result = await this.retryJob.execute(params.id);
    if (result.isErr()) {
      const response = { code: result.error.name, message: result.error.message };
      if (result.error instanceof JobNotFoundError) throw new NotFoundException(response);
      throw new ConflictException(response);
    }
    return this.toJobDto(result.value);
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

  private toJobDto(job: Job): JobDto {
    return JobDto.create({
      ...toJobSummaryResponse(job),
      activity: job.activity.map((event) => ({
        attempt: event.attempt,
        errorCategory: event.errorCategory,
        event: event.event,
        id: event.id,
        recordedAt: event.recordedAt.toISOString(),
      })),
    });
  }

  private toInput<TPayload extends object>(body: {
    idempotencyKey: string;
    maxAttempts: number;
    payload: TPayload;
    priority: number;
    startAt?: string | undefined;
    type: 'instant' | 'schedule';
  }): CreateJobInput<TPayload> {
    return {
      idempotencyKey: body.idempotencyKey,
      maxAttempts: body.maxAttempts,
      payload: body.payload,
      priority: body.priority,
      startAt: body.startAt === undefined ? undefined : new Date(body.startAt),
      type: body.type,
    };
  }

  private toCreated(result: Result<{ id: string; startAt: Date }, DomainError>): CreatedJobDto {
    if (result.isErr()) {
      const response = { code: result.error.name, message: result.error.message };
      if (result.error instanceof JobConflictError)
        throw new ConflictException({
          ...response,
          details: { existingJobId: result.error.existingJobId },
        });
      throw new BadRequestException(response);
    }
    return CreatedJobDto.create({
      id: result.value.id,
      startAt: result.value.startAt.toISOString(),
    });
  }
}
