import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AIRCRAFT_REPORT_QUEUE } from '@/common/queue/queue.service.js';
import { TransitJobPayloadSchema } from '@/modules/aircraft-transits/aircraft-transit.js';
import { GenerateAircraftTransitReportUseCase } from '@/modules/aircraft-transits/use-case/generate-aircraft-transit-report.use-case.js';
import { CompleteJobUseCase } from '@/modules/jobs/use-case/complete-job.use-case.js';
import { FailJobAttemptUseCase } from '@/modules/jobs/use-case/fail-job-attempt.use-case.js';
import { StartJobAttemptUseCase } from '@/modules/jobs/use-case/start-job-attempt.use-case.js';
import { jobLog } from '@/worker/core/job-log.js';
import { JobHandler } from '@/worker/core/pg-boss/job-handler.decorator.js';

import type {
  SameAirportError,
  UnknownAircraftError,
  UnknownAirportError,
} from '@/modules/aircraft-transits/use-case/generate-aircraft-transit-report.use-case.js';
import type { Job, JobResult } from 'pg-boss';

type TransitRequestError = SameAirportError | UnknownAircraftError | UnknownAirportError;

// Input errors never succeed on retry, so each goes straight to dead-letter.
const INPUT_ERROR_CATEGORIES: Record<TransitRequestError['name'], string> = {
  SameAirportError: 'same_airport',
  UnknownAircraftError: 'unknown_aircraft',
  UnknownAirportError: 'unknown_airport',
};

@Injectable()
@JobHandler(AIRCRAFT_REPORT_QUEUE)
export class AircraftReportJobHandler {
  constructor(
    private readonly logger: PinoLogger,
    private readonly generateReport: GenerateAircraftTransitReportUseCase,
    private readonly startAttempt: StartJobAttemptUseCase,
    private readonly failAttempt: FailJobAttemptUseCase,
    private readonly completeJob: CompleteJobUseCase,
  ) {
    this.logger.setContext(AircraftReportJobHandler.name);
  }

  async handle(job: Job<unknown>): Promise<JobResult> {
    const attempt = job.retryCount + 1;
    this.logger.info(jobLog(AIRCRAFT_REPORT_QUEUE, job.id, attempt, 'pickup'));
    await this.startAttempt.execute(job.id, attempt);
    const parsed = TransitJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) return this.deadLetter(job.id, attempt, 'invalid_payload');
    let category: string;
    try {
      const generated = await this.generateReport.execute({
        ...parsed.data,
        departureAt: new Date(parsed.data.departureAt),
        jobId: job.id,
      });
      if (generated.isOk()) {
        await this.completeJob.execute(job.id, attempt, { reportId: generated.value.id });
        this.logger.info(jobLog(AIRCRAFT_REPORT_QUEUE, job.id, attempt, 'completed'));
        return { id: job.id, status: 'completed' };
      }
      category = INPUT_ERROR_CATEGORIES[generated.error.name];
    } catch {
      return this.failAttemptFor(job.id, attempt, 'generation_or_storage');
    }
    return this.deadLetter(job.id, attempt, category);
  }

  private async deadLetter(id: string, attempt: number, category: string): Promise<JobResult> {
    await this.failAttempt.execute(id, attempt, category, true);
    const outcome = category === 'invalid_payload' ? 'invalid_payload' : 'failed';
    this.logger.warn(jobLog(AIRCRAFT_REPORT_QUEUE, id, attempt, outcome));
    return { id, status: 'deadletter' };
  }

  private async failAttemptFor(id: string, attempt: number, category: string): Promise<JobResult> {
    const { terminal } = await this.failAttempt.execute(id, attempt, category, false);
    this.logger.warn(
      jobLog(AIRCRAFT_REPORT_QUEUE, id, attempt, terminal ? 'failed' : 'retry_scheduled'),
    );
    return { id, status: terminal ? 'deadletter' : 'failed' };
  }
}
