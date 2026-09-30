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
import {
  JobBatchConflictError,
  JobBatchItemInvalidError,
  JobBatchNotFoundError,
} from '@/modules/jobs/job.errors.js';
import { CancelJobBatchUseCase } from '@/modules/jobs/use-case/cancel-job-batch.use-case.js';
import { CreateJobBatchUseCase } from '@/modules/jobs/use-case/create-job-batch.use-case.js';
import { GetJobBatchActivityUseCase } from '@/modules/jobs/use-case/get-job-batch-activity.use-case.js';
import { GetJobBatchUseCase } from '@/modules/jobs/use-case/get-job-batch.use-case.js';
import { ListJobBatchesUseCase } from '@/modules/jobs/use-case/list-job-batches.use-case.js';

import { CreateJobBatchDto } from './dtos/create-job-batch.dto.js';
import { CreatedJobBatchDto } from './dtos/created-job-batch.dto.js';
import { JobBatchActivityDto, toJobBatchActivityResponse } from './dtos/job-batch-activity.dto.js';
import { JobBatchIdDto } from './dtos/job-batch-id.dto.js';
import { JobBatchDto } from './dtos/job-batch.dto.js';
import { toJobBatchChildrenResponse, toJobBatchSummaryResponse } from './dtos/job-batch.schema.js';
import { JobBatchesPageDto } from './dtos/job-batches-page.dto.js';
import { ListJobBatchesDto } from './dtos/list-job-batches.dto.js';

import type { JobBatch } from '@/modules/jobs/job-batch.js';

@ApiTags('job-batches')
@Controller('job-batches')
export class JobBatchesController {
  constructor(
    private readonly createBatch: CreateJobBatchUseCase,
    private readonly getBatch: GetJobBatchUseCase,
    private readonly listBatches: ListJobBatchesUseCase,
    private readonly cancelBatch: CancelJobBatchUseCase,
    private readonly getActivity: GetJobBatchActivityUseCase,
  ) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    description:
      'Creates 1-100 child jobs (email, webhook, aircraft-report) sharing one schedule, priority and attempt limit. Everything is written and enqueued atomically.',
    summary: 'Create a batch of jobs',
  })
  @ApiBody({ type: CreateJobBatchDto })
  @ApiEnvelopeResponse(CreatedJobBatchDto.Output, 202)
  @ApiErrorEnvelopeResponse(
    400,
    'The schedule or a child is invalid; details.position is the 1-based child position.',
  )
  @ApiErrorEnvelopeResponse(409, 'The batch key has already been used (details.existingBatchId).')
  async create(@Body() body: CreateJobBatchDto): Promise<CreatedJobBatchDto> {
    const result = await this.createBatch.execute({
      idempotencyKey: body.idempotencyKey,
      items: body.items.map((item) =>
        item.type === 'aircraft-report'
          ? {
              payload: { ...item.payload, departureAt: new Date(item.payload.departureAt) },
              type: item.type,
            }
          : item,
      ),
      maxAttempts: body.maxAttempts,
      priority: body.priority,
      startAt: body.startAt === undefined ? undefined : new Date(body.startAt),
      type: body.type,
    });
    if (result.isErr()) {
      const error = result.error;
      const response = { code: error.name, message: error.message };
      if (error instanceof JobBatchConflictError)
        throw new ConflictException({
          ...response,
          details: { existingBatchId: error.existingBatchId },
        });
      if (error instanceof JobBatchItemInvalidError)
        throw new BadRequestException({
          ...response,
          details: { position: error.position, reason: error.reason.name },
        });
      throw new BadRequestException(response);
    }
    return CreatedJobBatchDto.create({
      id: result.value.id,
      startAt: result.value.startAt.toISOString(),
    });
  }

  @Get()
  @ApiOperation({
    description:
      'Newest first (createdAt, then id, descending). Status and progress are derived from the children when read.',
    summary: 'List batches with pagination',
  })
  @ApiEnvelopeResponse(JobBatchesPageDto.Output)
  async list(@Query() query: ListJobBatchesDto): Promise<JobBatchesPageDto> {
    const page = await this.listBatches.execute({ page: query.page, pageSize: query.pageSize });
    return JobBatchesPageDto.create({
      items: page.items.map((batch) => toJobBatchSummaryResponse(batch)),
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Get(':id')
  @ApiOperation({
    description:
      'Ordered children with effective statuses and results, status counts, progress, and the derived batch status.',
    summary: 'Get a batch',
  })
  @ApiEnvelopeResponse(JobBatchDto.Output)
  @ApiErrorEnvelopeResponse(404, 'The batch ID does not exist.')
  async get(@Param() params: JobBatchIdDto): Promise<JobBatchDto> {
    const result = await this.getBatch.execute(params.id);
    if (result.isErr()) throw new NotFoundException(this.notFound(result.error));
    return this.toDto(result.value);
  }

  @Get(':id/activity')
  @ApiOperation({
    description:
      'One feed, oldest first (time, then kind, task position, event ID): a batch-created entry, every task event tagged with job ID, queue, and 1-based position, and a cancellation-requested entry when one was made. Unpaged: at most 100 tasks.',
    summary: 'Get the activity of a batch',
  })
  @ApiEnvelopeResponse(JobBatchActivityDto.Output)
  @ApiErrorEnvelopeResponse(404, 'The batch ID does not exist.')
  async activity(@Param() params: JobBatchIdDto): Promise<JobBatchActivityDto> {
    const result = await this.getActivity.execute(params.id);
    if (result.isErr()) throw new NotFoundException(this.notFound(result.error));
    return JobBatchActivityDto.create({
      items: result.value.map((entry) => toJobBatchActivityResponse(entry)),
    });
  }

  @Delete(':id')
  @ApiOperation({
    description:
      'Records the request and cancels every unclaimed child. A child already processing finishes or fails without another retry. Repeating the request returns the batch unchanged.',
    summary: 'Cancel a batch',
  })
  @ApiEnvelopeResponse(JobBatchDto.Output)
  @ApiErrorEnvelopeResponse(404, 'The batch ID does not exist.')
  @ApiErrorEnvelopeResponse(409, 'Every child already finished and the batch was not cancelled.')
  async cancel(@Param() params: JobBatchIdDto): Promise<JobBatchDto> {
    const result = await this.cancelBatch.execute(params.id);
    if (result.isErr()) {
      const response = { code: result.error.name, message: result.error.message };
      if (result.error instanceof JobBatchNotFoundError) throw new NotFoundException(response);
      throw new ConflictException(response);
    }
    return this.toDto(result.value);
  }

  private notFound(error: JobBatchNotFoundError): { code: string; message: string } {
    return { code: error.name, message: error.message };
  }

  private toDto(batch: JobBatch): JobBatchDto {
    return JobBatchDto.create({
      ...toJobBatchSummaryResponse(batch),
      items: toJobBatchChildrenResponse(batch),
    });
  }
}
