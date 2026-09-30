import { Inject, Injectable } from '@nestjs/common';
import { err } from 'neverthrow';

import { AIRCRAFT_REPORT_QUEUE } from '@/common/queue/queue.service.js';
import { ValidateAircraftTransitRequestUseCase } from '@/modules/aircraft-transits/use-case/validate-aircraft-transit-request.use-case.js';
import { JOB_REPOSITORY } from '@/modules/jobs/ports/job.repository.js';

import { checkSubmission, enqueueJob } from './submit-job.js';

import type {
  DepartureInPastError,
  SameAirportError,
  TransitRequest,
  UnknownAircraftError,
  UnknownAirportError,
} from '@/modules/aircraft-transits/use-case/validate-aircraft-transit-request.use-case.js';
import type { JobConflictError, JobScheduleError } from '@/modules/jobs/job.errors.js';
import type { CreateJobInput } from '@/modules/jobs/job.js';
import type { JobRepository } from '@/modules/jobs/ports/job.repository.js';
import type { Result } from 'neverthrow';

export type CreateAircraftReportJobInput = CreateJobInput<TransitRequest>;

@Injectable()
export class CreateAircraftReportJobUseCase {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly repository: JobRepository,
    private readonly validateRequest: ValidateAircraftTransitRequestUseCase,
  ) {}

  async execute(
    input: CreateAircraftReportJobInput,
  ): Promise<
    Result<
      { id: string; startAt: Date },
      | JobConflictError
      | JobScheduleError
      | UnknownAirportError
      | UnknownAircraftError
      | SameAirportError
      | DepartureInPastError
    >
  > {
    const checked = await checkSubmission(this.repository, input);
    if (checked.isErr()) return err(checked.error);
    const validated = await this.validateRequest.execute(input.payload);
    if (validated.isErr()) return err(validated.error);
    return enqueueJob(this.repository, AIRCRAFT_REPORT_QUEUE, {
      ...input,
      payload: { ...input.payload, departureAt: input.payload.departureAt.toISOString() },
    });
  }
}
