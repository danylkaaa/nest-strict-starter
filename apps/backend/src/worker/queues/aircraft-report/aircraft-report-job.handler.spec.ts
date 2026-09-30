import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import {
  SameAirportError,
  UnknownAircraftError,
  UnknownAirportError,
} from '@/modules/aircraft-transits/aircraft-transit.errors.js';
import { AIRCRAFT, KSFO, NOW, RJTT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { buildTransitPath, toGeoJsonLineString } from '@/modules/aircraft-transits/transit-path.js';
import { GenerateAircraftTransitReportUseCase } from '@/modules/aircraft-transits/use-case/generate-aircraft-transit-report.use-case.js';
import { CompleteJobUseCase } from '@/modules/jobs/use-case/complete-job.use-case.js';
import { FailJobAttemptUseCase } from '@/modules/jobs/use-case/fail-job-attempt.use-case.js';
import { StartJobAttemptUseCase } from '@/modules/jobs/use-case/start-job-attempt.use-case.js';

import { AircraftReportJobHandler } from './aircraft-report-job.handler.js';

import type { AircraftTransitReport } from '@/modules/aircraft-transits/aircraft-transit.js';
import type { Job } from 'pg-boss';

const data = {
  aircraftId: 'acf_1',
  departureAt: '2030-01-01T10:00:00.000Z',
  destinationIcao: 'KSFO',
  originIcao: 'RJTT',
};
const departureAt = new Date(data.departureAt);
const path = buildTransitPath(RJTT, KSFO, AIRCRAFT, departureAt);
const report: AircraftTransitReport = {
  ...path,
  aircraft: AIRCRAFT,
  createdAt: NOW,
  departureAt,
  destination: KSFO,
  id: 'atr_1',
  origin: RJTT,
  path: toGeoJsonLineString(path.waypoints),
};

const job = (retryCount: number, jobData: unknown = data): Job<unknown> => ({
  data: jobData,
  expireInSeconds: 60,
  heartbeatSeconds: null,
  id: 'job-1',
  name: 'aircraft-report',
  retryCount,
  signal: new AbortController().signal,
});

const setup = async (execute: GenerateAircraftTransitReportUseCase['execute']) => {
  // The use case owns the terminal decision; here the job allows 4 attempts.
  const fail = vi
    .fn<FailJobAttemptUseCase['execute']>()
    .mockImplementation((_id, attempt, _category, deadLetter) =>
      Promise.resolve({ terminal: deadLetter || attempt >= 4 }),
    );
  const complete = vi.fn().mockResolvedValue(undefined);
  const start = vi.fn().mockResolvedValue(undefined);
  const logger = { info: vi.fn(), setContext: vi.fn(), warn: vi.fn() };
  const module = await Test.createTestingModule({
    providers: [
      AircraftReportJobHandler,
      { provide: PinoLogger, useValue: logger },
      { provide: GenerateAircraftTransitReportUseCase, useValue: { execute } },
      { provide: StartJobAttemptUseCase, useValue: { execute: start } },
      { provide: FailJobAttemptUseCase, useValue: { execute: fail } },
      { provide: CompleteJobUseCase, useValue: { execute: complete } },
    ],
  }).compile();
  return { complete, fail, handler: module.get(AircraftReportJobHandler), logger, start };
};

describe('aircraft report job handler', () => {
  it('generates the report for the job and completes with the report id', async () => {
    const execute = vi
      .fn<GenerateAircraftTransitReportUseCase['execute']>()
      .mockResolvedValue(ok(report));
    const { complete, fail, handler, start } = await setup(execute);
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'completed' });
    expect(start).toHaveBeenCalledWith('job-1', 1);
    expect(execute).toHaveBeenCalledWith({
      ...data,
      departureAt: new Date(data.departureAt),
      jobId: 'job-1',
    });
    expect(complete).toHaveBeenCalledWith('job-1', 1, { reportId: 'atr_1' });
    expect(fail).not.toHaveBeenCalled();
  });

  it('dead-letters an invalid payload without generating', async () => {
    const execute = vi.fn<GenerateAircraftTransitReportUseCase['execute']>();
    const { fail, handler } = await setup(execute);
    await expect(handler.handle(job(0, { originIcao: 'RJTT' }))).resolves.toEqual({
      id: 'job-1',
      status: 'deadletter',
    });
    expect(execute).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith('job-1', 1, 'invalid_payload', true);
  });

  it.each([
    [new UnknownAirportError('ZZZZ'), 'unknown_airport'],
    [new UnknownAircraftError('acf_x'), 'unknown_aircraft'],
    [new SameAirportError(), 'same_airport'],
  ])('dead-letters %s on the first attempt', async (error, category) => {
    const execute = vi
      .fn<GenerateAircraftTransitReportUseCase['execute']>()
      .mockResolvedValue(err(error));
    const { complete, fail, handler } = await setup(execute);
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'deadletter' });
    expect(fail).toHaveBeenCalledWith('job-1', 1, category, true);
    expect(complete).not.toHaveBeenCalled();
  });

  it('treats a thrown error as a retryable failure', async () => {
    const { fail, handler, logger } = await setup(() => Promise.reject(new Error('db down')));
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'failed' });
    expect(fail).toHaveBeenCalledWith('job-1', 1, 'generation_or_storage', false);
    expect(logger.warn).toHaveBeenCalledWith({
      attempt: 1,
      jobId: 'job-1',
      outcome: 'retry_scheduled',
      queue: 'aircraft-report',
    });
  });

  it('dead-letters a thrown error on the final attempt', async () => {
    const { fail, handler } = await setup(() => Promise.reject(new Error('db down')));
    await expect(handler.handle(job(3))).resolves.toEqual({ id: 'job-1', status: 'deadletter' });
    expect(fail).toHaveBeenCalledWith('job-1', 4, 'generation_or_storage', false);
  });
});
