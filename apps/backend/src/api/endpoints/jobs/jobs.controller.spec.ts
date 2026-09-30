import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { UnknownAirportError } from '@/modules/aircraft-transits/aircraft-transit.errors.js';
import {
  JobConflictError,
  JobNotFoundError,
  JobNotRetryableError,
  JobScheduleError,
} from '@/modules/jobs/job.errors.js';
import { jobSummary } from '@/modules/jobs/testing/fixtures.js';
import { CancelJobUseCase } from '@/modules/jobs/use-case/cancel-job.use-case.js';
import { CreateAircraftReportJobUseCase } from '@/modules/jobs/use-case/create-aircraft-report-job.use-case.js';
import { CreateEmailJobUseCase } from '@/modules/jobs/use-case/create-email-job.use-case.js';
import { CreateWebhookJobUseCase } from '@/modules/jobs/use-case/create-webhook-job.use-case.js';
import { GetJobStatsUseCase } from '@/modules/jobs/use-case/get-job-stats.use-case.js';
import { GetJobUseCase } from '@/modules/jobs/use-case/get-job.use-case.js';
import { ListJobsUseCase } from '@/modules/jobs/use-case/list-jobs.use-case.js';
import { RetryJobUseCase } from '@/modules/jobs/use-case/retry-job.use-case.js';

import { CreateAircraftReportJobDto } from './dtos/create-aircraft-report-job.dto.js';
import { CreateWebhookJobDto } from './dtos/create-webhook-job.dto.js';
import { JobDto } from './dtos/job.dto.js';
import { JobsPageDto } from './dtos/jobs-page.dto.js';
import { ListJobsDto } from './dtos/list-jobs.dto.js';
import { JobsController } from './jobs.controller.js';

const startAt = new Date('2031-01-01T10:00:00.000Z');
const webhookBody = CreateWebhookJobDto.create({
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  maxAttempts: 2,
  payload: { method: 'PUT', payload: { hello: 'world' }, url: 'https://example.com/hook' },
  priority: 2,
  startAt: startAt.toISOString(),
  type: 'schedule',
});
const reportBody = CreateAircraftReportJobDto.create({
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  maxAttempts: 4,
  payload: {
    aircraftId: 'acf_1',
    departureAt: '2031-02-01T10:00:00.000Z',
    destinationIcao: 'KSFO',
    originIcao: 'RJTT',
  },
  priority: 2,
  type: 'instant',
});

const setup = async () => {
  const createWebhook = vi.fn<CreateWebhookJobUseCase['execute']>();
  const createReport = vi.fn<CreateAircraftReportJobUseCase['execute']>();
  const list = vi.fn<ListJobsUseCase['execute']>();
  const stats = vi.fn<GetJobStatsUseCase['execute']>();
  const retry = vi.fn<RetryJobUseCase['execute']>();
  const get = vi.fn<GetJobUseCase['execute']>();
  const module = await Test.createTestingModule({
    controllers: [JobsController],
    providers: [
      { provide: CreateEmailJobUseCase, useValue: { execute: vi.fn() } },
      { provide: CreateWebhookJobUseCase, useValue: { execute: createWebhook } },
      { provide: CreateAircraftReportJobUseCase, useValue: { execute: createReport } },
      { provide: GetJobUseCase, useValue: { execute: get } },
      { provide: ListJobsUseCase, useValue: { execute: list } },
      { provide: GetJobStatsUseCase, useValue: { execute: stats } },
      { provide: CancelJobUseCase, useValue: { execute: vi.fn() } },
      { provide: RetryJobUseCase, useValue: { execute: retry } },
    ],
  }).compile();
  return {
    controller: module.get(JobsController),
    createReport,
    createWebhook,
    get,
    list,
    retry,
    stats,
  };
};

describe('jobs controller submissions', () => {
  it('passes a webhook job to its use case and serializes the created job', async () => {
    const { controller, createWebhook } = await setup();
    createWebhook.mockResolvedValue(ok({ id: 'f1c0a1d2-0000-4000-8000-000000000001', startAt }));
    await expect(controller.createWebhook(webhookBody)).resolves.toEqual({
      id: 'f1c0a1d2-0000-4000-8000-000000000001',
      startAt: startAt.toISOString(),
    });
    expect(createWebhook).toHaveBeenCalledWith({
      idempotencyKey: webhookBody.idempotencyKey,
      maxAttempts: 2,
      payload: webhookBody.payload,
      priority: 2,
      startAt,
      type: 'schedule',
    });
  });

  it('maps a used key to 409 and a bad schedule to 400', async () => {
    const { controller, createWebhook } = await setup();
    createWebhook.mockResolvedValueOnce(err(new JobConflictError('job-0')));
    await expect(controller.createWebhook(webhookBody)).rejects.toBeInstanceOf(ConflictException);
    createWebhook.mockResolvedValueOnce(err(new JobScheduleError()));
    await expect(controller.createWebhook(webhookBody)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('converts the report departure to a Date and maps validation errors to 400', async () => {
    const { controller, createReport } = await setup();
    createReport.mockResolvedValue(err(new UnknownAirportError('RJTT')));
    await expect(controller.createAircraftReport(reportBody)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ departureAt: new Date('2031-02-01T10:00:00.000Z') }),
      }),
    );
  });

  it('maps a used key on the report queue to 409', async () => {
    const { controller, createReport } = await setup();
    createReport.mockResolvedValue(err(new JobConflictError('job-0')));
    await expect(controller.createAircraftReport(reportBody)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('jobs controller conflicts', () => {
  it('carries the existing job ID in the 409 details', async () => {
    const { controller, createWebhook } = await setup();
    createWebhook.mockResolvedValue(err(new JobConflictError('job-0')));
    await expect(controller.createWebhook(webhookBody)).rejects.toMatchObject({
      response: {
        code: 'JobConflictError',
        details: { existingJobId: 'job-0' },
        message: 'The idempotency key was already used.',
      },
    });
  });
});

describe('jobs controller list and stats', () => {
  it('parses the query defaults, status list, and search into the use case input', async () => {
    const { controller, list } = await setup();
    list.mockResolvedValue({
      items: [jobSummary({ completedAt: new Date('2030-01-02T00:00:00Z'), status: 'completed' })],
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
    });

    const page = await controller.list(
      ListJobsDto.create({
        page: '2',
        pageSize: '5',
        queue: 'webhook',
        search: ' abc ',
        status: 'failed, pending',
      }),
    );

    expect(list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
      queue: 'webhook',
      search: 'abc',
      statuses: ['failed', 'pending'],
    });
    expect(page).toMatchObject({
      items: [
        {
          completedAt: '2030-01-02T00:00:00.000Z',
          createdAt: '2030-01-01T00:00:00.000Z',
          maxAttempts: 4,
          status: 'completed',
        },
      ],
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
    });
    expect(JobsPageDto.schema.safeParse(page).success).toBe(true);
  });

  it('uses page 1 of 10 and no filters by default', async () => {
    const { controller, list } = await setup();
    list.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
    await controller.list(ListJobsDto.create({}));
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it.each([
    { pageSize: '0' },
    { pageSize: '101' },
    { page: '0' },
    { status: 'bogus' },
    { queue: 'sms' },
  ])('rejects the invalid query %o', (query) => {
    expect(ListJobsDto.schema.safeParse(query).success).toBe(false);
  });

  it('serializes the stats', async () => {
    const { controller, stats } = await setup();
    const counts = {
      cancelled: 0,
      completed: 4,
      failed: 1,
      pending: 2,
      processing: 0,
      scheduled: 3,
    };
    stats.mockResolvedValue({ counts, healthy: true });
    await expect(controller.stats()).resolves.toEqual({ counts, healthy: true });
  });
});

describe('jobs controller retry', () => {
  it('returns the retried job with its activity', async () => {
    const { controller, retry } = await setup();
    retry.mockResolvedValue(
      ok({
        ...jobSummary({ maxAttempts: 5, status: 'pending' }),
        activity: [
          {
            attempt: 5,
            errorCategory: null,
            event: 'retried',
            id: 'jac_1',
            recordedAt: new Date('2030-01-01T00:00:00Z'),
          },
        ],
      }),
    );
    const job = await controller.retry({ id: 'job-1' });
    expect(job).toMatchObject({ maxAttempts: 5, status: 'pending' });
    expect(job.activity).toEqual([
      {
        attempt: 5,
        errorCategory: null,
        event: 'retried',
        id: 'jac_1',
        recordedAt: '2030-01-01T00:00:00.000Z',
      },
    ]);
    expect(JobDto.schema.safeParse(job).success).toBe(true);
  });

  it('maps an unknown job to 404 and a non-failed job to 409', async () => {
    const { controller, retry } = await setup();
    retry.mockResolvedValueOnce(err(new JobNotFoundError()));
    await expect(controller.retry({ id: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    retry.mockResolvedValueOnce(err(new JobNotRetryableError()));
    await expect(controller.retry({ id: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });
});
