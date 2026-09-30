import { err } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import {
  DepartureInPastError,
  SameAirportError,
  UnknownAircraftError,
  UnknownAirportError,
} from '@/modules/aircraft-transits/aircraft-transit.errors.js';
import { FixedClock } from '@/modules/aircraft-transits/testing/fixed.clock.js';
import { AIRCRAFT, NOW } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { ValidateAircraftTransitRequestUseCase } from '@/modules/aircraft-transits/use-case/validate-aircraft-transit-request.use-case.js';
import { JobConflictError, JobScheduleError } from '@/modules/jobs/job.errors.js';
import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';

import { CreateAircraftReportJobUseCase } from './create-aircraft-report-job.use-case.js';

const departureAt = new Date('2031-01-01T10:00:00.000Z');
const input = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  maxAttempts: 4,
  payload: {
    aircraftId: AIRCRAFT.id,
    departureAt,
    destinationIcao: 'KSFO',
    originIcao: 'RJTT',
  },
  priority: 2,
  type: 'instant',
} as const;

const setup = () => {
  const repository = fakeJobRepository();
  const transits = new InMemoryAircraftTransitRepository();
  const useCase = new CreateAircraftReportJobUseCase(
    repository,
    new ValidateAircraftTransitRequestUseCase(transits, new FixedClock()),
  );
  return { repository, transits, useCase };
};

describe('create aircraft report job use case', () => {
  it('validates the request, then enqueues a JSON payload on the aircraft-report queue', async () => {
    const { repository, transits, useCase } = setup();
    const result = await useCase.execute(input);
    expect(result.isOk()).toBe(true);
    expect(transits.lookups).toContain('findAirports');
    expect(repository.create).toHaveBeenCalledWith('aircraft-report', {
      ...input,
      payload: { ...input.payload, departureAt: departureAt.toISOString() },
      startAt: undefined,
    });
  });

  it('reports a used key as a conflict without validating the request', async () => {
    const { repository, transits, useCase } = setup();
    repository.findSubmission.mockResolvedValue('job-0');
    const result = await useCase.execute({
      ...input,
      payload: { ...input.payload, originIcao: 'ZZZZ' },
    });
    expect(result).toEqual(err(expect.any(JobConflictError)));
    expect(transits.lookups).toEqual([]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects an elapsed schedule before validating the request', async () => {
    const { transits, useCase } = setup();
    const result = await useCase.execute({
      ...input,
      startAt: new Date(Date.now() - 1000),
      type: 'schedule',
    });
    expect(result).toEqual(err(expect.any(JobScheduleError)));
    expect(transits.lookups).toEqual([]);
  });

  it.each([
    ['an unknown airport', { originIcao: 'ZZZZ' }, UnknownAirportError],
    ['an unknown aircraft', { aircraftId: 'acf_missing' }, UnknownAircraftError],
    ['the same airport', { destinationIcao: 'RJTT' }, SameAirportError],
    ['a past departure', { departureAt: new Date(NOW.getTime() - 1000) }, DepartureInPastError],
  ])('rejects %s and enqueues nothing', async (_name, change, ErrorClass) => {
    const { repository, useCase } = setup();
    const result = await useCase.execute({ ...input, payload: { ...input.payload, ...change } });
    expect(result).toEqual(err(expect.any(ErrorClass)));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('reports a concurrent duplicate found by the repository as a conflict', async () => {
    const { repository, useCase } = setup();
    repository.create.mockResolvedValue({ duplicate: true, id: 'job-0', startAt: new Date() });
    const result = await useCase.execute(input);
    expect(result).toEqual(err(expect.any(JobConflictError)));
  });
});
