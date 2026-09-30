import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { UnknownAirportError } from '@/modules/aircraft-transits/aircraft-transit.errors.js';
import { summarizeBatch, toJobBatch } from '@/modules/jobs/job-batch.js';
import {
  JobBatchConflictError,
  JobBatchItemInvalidError,
  JobBatchNotCancellableError,
  JobBatchNotFoundError,
  JobScheduleError,
} from '@/modules/jobs/job.errors.js';
import { jobBatchRecord, jobSummary } from '@/modules/jobs/testing/fixtures.js';
import { CancelJobBatchUseCase } from '@/modules/jobs/use-case/cancel-job-batch.use-case.js';
import { CreateJobBatchUseCase } from '@/modules/jobs/use-case/create-job-batch.use-case.js';
import { GetJobBatchActivityUseCase } from '@/modules/jobs/use-case/get-job-batch-activity.use-case.js';
import { GetJobBatchUseCase } from '@/modules/jobs/use-case/get-job-batch.use-case.js';
import { ListJobBatchesUseCase } from '@/modules/jobs/use-case/list-job-batches.use-case.js';

import { CreateJobBatchDto } from './dtos/create-job-batch.dto.js';
import { JobBatchActivityDto } from './dtos/job-batch-activity.dto.js';
import { JobBatchDto } from './dtos/job-batch.dto.js';
import { JobBatchesPageDto } from './dtos/job-batches-page.dto.js';
import { ListJobBatchesDto } from './dtos/list-job-batches.dto.js';
import { JobBatchesController } from './job-batches.controller.js';

const startAt = new Date('2031-01-01T10:00:00.000Z');
const body = CreateJobBatchDto.create({
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  items: [
    { payload: { body: 'Hi', recipient: 'a@example.com', subject: 'Hello' }, type: 'email' },
    {
      payload: {
        aircraftId: 'acf_1',
        departureAt: '2031-02-01T10:00:00.000Z',
        destinationIcao: 'KSFO',
        originIcao: 'RJTT',
      },
      type: 'aircraft-report',
    },
  ],
  maxAttempts: 2,
  priority: 2,
  startAt: startAt.toISOString(),
  type: 'schedule',
});

const A_ID = 'f1c0a1d2-0000-4000-8000-00000000000a';
const B_ID = 'f1c0a1d2-0000-4000-8000-00000000000b';

const batch = () =>
  toJobBatch(
    jobBatchRecord({ startAt: new Date('2020-01-01T00:00:00Z') }),
    [
      {
        job: jobSummary({ id: A_ID, result: { emailId: 'eml_1' }, status: 'completed' }),
        position: 1,
      },
      { job: jobSummary({ id: B_ID, queue: 'webhook', status: 'processing' }), position: 2 },
    ],
    new Date(),
  );

const setup = async () => {
  const create = vi.fn<CreateJobBatchUseCase['execute']>();
  const get = vi.fn<GetJobBatchUseCase['execute']>();
  const list = vi.fn<ListJobBatchesUseCase['execute']>();
  const cancel = vi.fn<CancelJobBatchUseCase['execute']>();
  const activity = vi.fn<GetJobBatchActivityUseCase['execute']>();
  const module = await Test.createTestingModule({
    controllers: [JobBatchesController],
    providers: [
      { provide: CreateJobBatchUseCase, useValue: { execute: create } },
      { provide: GetJobBatchUseCase, useValue: { execute: get } },
      { provide: ListJobBatchesUseCase, useValue: { execute: list } },
      { provide: CancelJobBatchUseCase, useValue: { execute: cancel } },
      { provide: GetJobBatchActivityUseCase, useValue: { execute: activity } },
    ],
  }).compile();
  return { activity, cancel, controller: module.get(JobBatchesController), create, get, list };
};

describe('job batches controller create', () => {
  it('maps the request to the use case, converting dates, and serializes the result', async () => {
    const { controller, create } = await setup();
    create.mockResolvedValue(ok({ id: 'f1c0a1d2-0000-4000-8000-000000000001', startAt }));

    await expect(controller.create(body)).resolves.toEqual({
      id: 'f1c0a1d2-0000-4000-8000-000000000001',
      startAt: startAt.toISOString(),
    });
    expect(create).toHaveBeenCalledWith({
      idempotencyKey: body.idempotencyKey,
      items: [
        body.items[0],
        {
          payload: { ...body.items[1]?.payload, departureAt: new Date('2031-02-01T10:00:00.000Z') },
          type: 'aircraft-report',
        },
      ],
      maxAttempts: 2,
      priority: 2,
      startAt,
      type: 'schedule',
    });
  });

  it('maps a used key to 409 with the existing batch ID', async () => {
    const { controller, create } = await setup();
    create.mockResolvedValue(err(new JobBatchConflictError('batch-0')));
    await expect(controller.create(body)).rejects.toBeInstanceOf(ConflictException);
    await expect(controller.create(body)).rejects.toMatchObject({
      response: { code: 'JobBatchConflictError', details: { existingBatchId: 'batch-0' } },
    });
  });

  it('maps an invalid child to 400 with its position', async () => {
    const { controller, create } = await setup();
    create.mockResolvedValue(err(new JobBatchItemInvalidError(2, new UnknownAirportError('RJTT'))));
    await expect(controller.create(body)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.create(body)).rejects.toMatchObject({
      response: { details: { position: 2, reason: 'UnknownAirportError' } },
    });
  });

  it('maps a bad schedule to 400', async () => {
    const { controller, create } = await setup();
    create.mockResolvedValue(err(new JobScheduleError()));
    await expect(controller.create(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('job batches controller reads', () => {
  it('serializes the batch with ordered children, counts, progress, and links', async () => {
    const { controller, get } = await setup();
    get.mockResolvedValue(ok(batch()));
    const dto = await controller.get({ id: 'b-1' });
    expect(dto).toMatchObject({
      counts: { completed: 1, processing: 1 },
      progress: 50,
      status: 'processing',
      total: 2,
    });
    expect(dto.items).toMatchObject([
      {
        id: A_ID,
        link: `/api/jobs/${A_ID}`,
        position: 1,
        result: { emailId: 'eml_1' },
        status: 'completed',
      },
      { id: B_ID, link: `/api/jobs/${B_ID}`, position: 2, queue: 'webhook', status: 'processing' },
    ]);
    expect(JobBatchDto.schema.safeParse(dto).success).toBe(true);
  });

  it('maps an unknown batch to 404', async () => {
    const { controller, get } = await setup();
    get.mockResolvedValue(err(new JobBatchNotFoundError()));
    await expect(controller.get({ id: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('parses the paging query and serializes the page', async () => {
    const { controller, list } = await setup();
    list.mockResolvedValue({
      items: [
        summarizeBatch(
          jobBatchRecord({ startAt: new Date('2020-01-01T00:00:00Z') }),
          [{ attempts: 0, status: 'pending' }],
          new Date(),
        ),
      ],
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
    });
    const page = await controller.list(ListJobBatchesDto.create({ page: '2', pageSize: '5' }));
    expect(list).toHaveBeenCalledWith({ page: 2, pageSize: 5 });
    expect(page).toMatchObject({ page: 2, pageSize: 5, total: 6, totalPages: 2 });
    expect(JobBatchesPageDto.schema.safeParse(page).success).toBe(true);
  });

  it('defaults to page 1 of 10 and rejects bad paging', async () => {
    const { controller, list } = await setup();
    list.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
    await controller.list(ListJobBatchesDto.create({}));
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(ListJobBatchesDto.schema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(ListJobBatchesDto.schema.safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('job batches controller activity', () => {
  it('serializes the feed in the order the use case returns it', async () => {
    const { activity, controller } = await setup();
    activity.mockResolvedValue(
      ok([
        {
          attempt: null,
          errorCategory: null,
          event: 'batch_created',
          id: 'batch_created:b-1',
          jobId: null,
          position: null,
          queue: null,
          recordedAt: new Date('2030-01-01T00:00:00Z'),
        },
        {
          attempt: 1,
          errorCategory: 'delivery_failed',
          event: 'attempt_failed',
          id: 'jac_1',
          jobId: B_ID,
          position: 2,
          queue: 'webhook',
          recordedAt: new Date('2030-01-01T00:00:05Z'),
        },
      ]),
    );
    const dto = await controller.activity({ id: 'b-1' });
    expect(activity).toHaveBeenCalledWith('b-1');
    expect(dto.items).toEqual([
      expect.objectContaining({
        event: 'batch_created',
        jobId: null,
        recordedAt: '2030-01-01T00:00:00.000Z',
      }),
      expect.objectContaining({
        errorCategory: 'delivery_failed',
        jobId: B_ID,
        position: 2,
        queue: 'webhook',
        recordedAt: '2030-01-01T00:00:05.000Z',
      }),
    ]);
    expect(JobBatchActivityDto.schema.safeParse(dto).success).toBe(true);
  });

  it('maps an unknown batch to 404', async () => {
    const { activity, controller } = await setup();
    activity.mockResolvedValue(err(new JobBatchNotFoundError()));
    await expect(controller.activity({ id: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('job batches controller cancel', () => {
  it('returns the current batch', async () => {
    const { cancel, controller } = await setup();
    cancel.mockResolvedValue(ok(batch()));
    await expect(controller.cancel({ id: 'b-1' })).resolves.toMatchObject({ total: 2 });
    expect(cancel).toHaveBeenCalledWith('b-1');
  });

  it('maps an unknown batch to 404 and a finished one to 409', async () => {
    const { cancel, controller } = await setup();
    cancel.mockResolvedValueOnce(err(new JobBatchNotFoundError()));
    await expect(controller.cancel({ id: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    cancel.mockResolvedValueOnce(err(new JobBatchNotCancellableError()));
    await expect(controller.cancel({ id: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });
});
