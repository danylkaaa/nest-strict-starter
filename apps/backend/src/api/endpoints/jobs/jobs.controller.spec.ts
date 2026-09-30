import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { UnknownAirportError } from '@/modules/aircraft-transits/aircraft-transit.errors.js';
import { JobConflictError, JobScheduleError } from '@/modules/jobs/job.errors.js';
import { CancelJobUseCase } from '@/modules/jobs/use-case/cancel-job.use-case.js';
import { CreateAircraftReportJobUseCase } from '@/modules/jobs/use-case/create-aircraft-report-job.use-case.js';
import { CreateEmailJobUseCase } from '@/modules/jobs/use-case/create-email-job.use-case.js';
import { CreateWebhookJobUseCase } from '@/modules/jobs/use-case/create-webhook-job.use-case.js';
import { GetJobUseCase } from '@/modules/jobs/use-case/get-job.use-case.js';

import { CreateAircraftReportJobDto } from './dtos/create-aircraft-report-job.dto.js';
import { CreateWebhookJobDto } from './dtos/create-webhook-job.dto.js';
import { JobsController } from './jobs.controller.js';

const startAt = new Date('2031-01-01T10:00:00.000Z');
const webhookBody = CreateWebhookJobDto.create({
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  payload: { payload: { hello: 'world' }, url: 'https://example.com/hook' },
  priority: 2,
  startAt: startAt.toISOString(),
  type: 'schedule',
});
const reportBody = CreateAircraftReportJobDto.create({
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
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
  const module = await Test.createTestingModule({
    controllers: [JobsController],
    providers: [
      { provide: CreateEmailJobUseCase, useValue: { execute: vi.fn() } },
      { provide: CreateWebhookJobUseCase, useValue: { execute: createWebhook } },
      { provide: CreateAircraftReportJobUseCase, useValue: { execute: createReport } },
      { provide: GetJobUseCase, useValue: { execute: vi.fn() } },
      { provide: CancelJobUseCase, useValue: { execute: vi.fn() } },
    ],
  }).compile();
  return { controller: module.get(JobsController), createReport, createWebhook };
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
      payload: webhookBody.payload,
      priority: 2,
      startAt,
      type: 'schedule',
    });
  });

  it('maps a used key to 409 and a bad schedule to 400', async () => {
    const { controller, createWebhook } = await setup();
    createWebhook.mockResolvedValueOnce(err(new JobConflictError()));
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
    createReport.mockResolvedValue(err(new JobConflictError()));
    await expect(controller.createAircraftReport(reportBody)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
