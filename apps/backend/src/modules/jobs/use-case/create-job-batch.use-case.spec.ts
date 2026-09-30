import { err } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import {
  DepartureInPastError,
  UnknownAirportError,
} from '@/modules/aircraft-transits/aircraft-transit.errors.js';
import { FixedClock } from '@/modules/aircraft-transits/testing/fixed.clock.js';
import { AIRCRAFT } from '@/modules/aircraft-transits/testing/fixtures.js';
import { InMemoryAircraftTransitRepository } from '@/modules/aircraft-transits/testing/in-memory-aircraft-transit.repository.js';
import { ValidateAircraftTransitRequestUseCase } from '@/modules/aircraft-transits/use-case/validate-aircraft-transit-request.use-case.js';
import { JobBatchConflictError, JobScheduleError } from '@/modules/jobs/job.errors.js';
import { fakeJobRepository } from '@/modules/jobs/testing/fake-job.repository.js';

import { CreateJobBatchUseCase } from './create-job-batch.use-case.js';

import type { CreateJobBatchInput, JobBatchItem } from '@/modules/jobs/job-batch.js';

const departureAt = new Date('2031-01-01T10:00:00.000Z');
const email: JobBatchItem = {
  payload: { body: 'Hi', recipient: 'a@example.com', subject: 'Hello' },
  type: 'email',
};
const webhook: JobBatchItem = {
  payload: { method: 'POST', payload: { a: 1 }, url: 'https://example.com/hook' },
  type: 'webhook',
};
const report: JobBatchItem = {
  payload: { aircraftId: AIRCRAFT.id, departureAt, destinationIcao: 'KSFO', originIcao: 'RJTT' },
  type: 'aircraft-report',
};
const input: CreateJobBatchInput = {
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  items: [email, webhook, report],
  maxAttempts: 3,
  priority: 2,
  type: 'instant',
};

const setup = () => {
  const repository = fakeJobRepository();
  const transits = new InMemoryAircraftTransitRepository();
  const useCase = new CreateJobBatchUseCase(
    repository,
    new ValidateAircraftTransitRequestUseCase(transits, new FixedClock()),
  );
  return { repository, transits, useCase };
};

describe('create job batch use case', () => {
  it('creates the batch with every typed child in submitted order and fresh internal keys', async () => {
    const { repository, useCase } = setup();
    const result = await useCase.execute(input);

    expect(result.isOk()).toBe(true);
    expect(repository.createBatch).toHaveBeenCalledTimes(1);
    expect(repository.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: input.idempotencyKey,
        items: [
          expect.objectContaining({ payload: email.payload, queue: 'email' }),
          expect.objectContaining({ payload: webhook.payload, queue: 'webhook' }),
          expect.objectContaining({
            payload: { ...report.payload, departureAt: departureAt.toISOString() },
            queue: 'aircraft-report',
          }),
        ],
        maxAttempts: 3,
        priority: 2,
        startAt: undefined,
        type: 'instant',
      }),
    );
    const keys = repository.createBatch.mock.calls.flatMap(([created]) =>
      created.items.map((item) => item.idempotencyKey),
    );
    expect(new Set(keys).size).toBe(3);
    expect(keys).not.toContain(input.idempotencyKey);
  });

  it('passes the shared schedule to the repository', async () => {
    const { repository, useCase } = setup();
    const startAt = new Date(Date.now() + 60_000);
    await useCase.execute({ ...input, startAt, type: 'schedule' });
    expect(repository.createBatch).toHaveBeenCalledWith(expect.objectContaining({ startAt }));
  });

  it('reports a used batch key before validating the schedule or any child', async () => {
    const { repository, transits, useCase } = setup();
    repository.findBatchSubmission.mockResolvedValue('batch-0');
    const result = await useCase.execute({
      ...input,
      items: [{ ...report, payload: { ...report.payload, originIcao: 'ZZZZ' } }],
      startAt: new Date(Date.now() - 1000),
      type: 'schedule',
    });
    expect(result).toEqual(err(new JobBatchConflictError('batch-0')));
    expect(transits.lookups).toEqual([]);
    expect(repository.createBatch).not.toHaveBeenCalled();
  });

  it('rejects an elapsed or missing schedule before validating children', async () => {
    const { repository, transits, useCase } = setup();
    const elapsed = await useCase.execute({
      ...input,
      startAt: new Date(Date.now() - 1000),
      type: 'schedule',
    });
    const missing = await useCase.execute({ ...input, type: 'schedule' });
    expect(elapsed).toEqual(err(expect.any(JobScheduleError)));
    expect(missing).toEqual(err(expect.any(JobScheduleError)));
    expect(transits.lookups).toEqual([]);
    expect(repository.createBatch).not.toHaveBeenCalled();
  });

  it('reports the first invalid child by its 1-based position and writes nothing', async () => {
    const { repository, useCase } = setup();
    const result = await useCase.execute({
      ...input,
      items: [
        email,
        webhook,
        { ...report, payload: { ...report.payload, originIcao: 'ZZZZ' } },
        { ...report, payload: { ...report.payload, departureAt: new Date(0) } },
      ],
    });
    expect(result).toEqual(
      err(
        expect.objectContaining({
          position: 3,
          reason: expect.any(UnknownAirportError),
        }),
      ),
    );
    expect(repository.createBatch).not.toHaveBeenCalled();
  });

  it('applies the standalone past-departure rule to a child', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      ...input,
      items: [{ ...report, payload: { ...report.payload, departureAt: new Date(0) } }],
    });
    expect(result).toEqual(
      err(expect.objectContaining({ position: 1, reason: expect.any(DepartureInPastError) })),
    );
  });

  it('reports a concurrent duplicate found by the repository as a conflict with its ID', async () => {
    const { repository, useCase } = setup();
    repository.createBatch.mockResolvedValue({
      duplicate: true,
      id: 'batch-0',
      startAt: new Date(),
    });
    await expect(useCase.execute(input)).resolves.toEqual(
      err(new JobBatchConflictError('batch-0')),
    );
  });

  it('propagates a repository failure so no partial batch is reported', async () => {
    const { repository, useCase } = setup();
    repository.createBatch.mockRejectedValue(new Error('enqueue failed'));
    await expect(useCase.execute(input)).rejects.toThrow('enqueue failed');
  });
});
