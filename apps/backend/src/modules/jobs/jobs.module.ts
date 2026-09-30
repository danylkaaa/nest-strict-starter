import { Module } from '@nestjs/common';

import { AircraftTransitsModule } from '@/modules/aircraft-transits/aircraft-transits.module.js';

import { DrizzleJobRepository } from './job.repository.js';
import { JobService } from './job.service.js';
import { JOB_REPOSITORY } from './ports/job.repository.js';
import { CancelJobUseCase } from './use-case/cancel-job.use-case.js';
import { CompleteJobUseCase } from './use-case/complete-job.use-case.js';
import { CreateAircraftReportJobUseCase } from './use-case/create-aircraft-report-job.use-case.js';
import { CreateEmailJobUseCase } from './use-case/create-email-job.use-case.js';
import { CreateWebhookJobUseCase } from './use-case/create-webhook-job.use-case.js';
import { FailJobAttemptUseCase } from './use-case/fail-job-attempt.use-case.js';
import { GetJobStatsUseCase } from './use-case/get-job-stats.use-case.js';
import { GetJobUseCase } from './use-case/get-job.use-case.js';
import { ListJobsUseCase } from './use-case/list-jobs.use-case.js';
import { ReconcileJobsUseCase } from './use-case/reconcile-jobs.use-case.js';
import { RetryJobUseCase } from './use-case/retry-job.use-case.js';
import { StartJobAttemptUseCase } from './use-case/start-job-attempt.use-case.js';

@Module({
  exports: [
    CreateEmailJobUseCase,
    CreateWebhookJobUseCase,
    CreateAircraftReportJobUseCase,
    GetJobUseCase,
    ListJobsUseCase,
    GetJobStatsUseCase,
    CancelJobUseCase,
    RetryJobUseCase,
    StartJobAttemptUseCase,
    FailJobAttemptUseCase,
    CompleteJobUseCase,
    ReconcileJobsUseCase,
  ],
  imports: [AircraftTransitsModule],
  providers: [
    JobService,
    CreateEmailJobUseCase,
    CreateWebhookJobUseCase,
    CreateAircraftReportJobUseCase,
    GetJobUseCase,
    ListJobsUseCase,
    GetJobStatsUseCase,
    CancelJobUseCase,
    RetryJobUseCase,
    StartJobAttemptUseCase,
    FailJobAttemptUseCase,
    CompleteJobUseCase,
    ReconcileJobsUseCase,
    { provide: JOB_REPOSITORY, useClass: DrizzleJobRepository },
  ],
})
export class JobsModule {}
