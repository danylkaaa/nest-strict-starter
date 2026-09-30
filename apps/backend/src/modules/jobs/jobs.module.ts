import { Module } from '@nestjs/common';

import { DrizzleJobRepository } from './job.repository.js';
import { JobService } from './job.service.js';
import { JOB_REPOSITORY } from './ports/job.repository.js';
import { CancelJobUseCase } from './use-case/cancel-job.use-case.js';
import { CompleteJobUseCase } from './use-case/complete-job.use-case.js';
import { CreateEmailJobUseCase } from './use-case/create-email-job.use-case.js';
import { FailJobAttemptUseCase } from './use-case/fail-job-attempt.use-case.js';
import { GetJobUseCase } from './use-case/get-job.use-case.js';
import { ReconcileJobsUseCase } from './use-case/reconcile-jobs.use-case.js';
import { StartJobAttemptUseCase } from './use-case/start-job-attempt.use-case.js';

@Module({
  exports: [
    CreateEmailJobUseCase,
    GetJobUseCase,
    CancelJobUseCase,
    StartJobAttemptUseCase,
    FailJobAttemptUseCase,
    CompleteJobUseCase,
    ReconcileJobsUseCase,
  ],
  providers: [
    JobService,
    CreateEmailJobUseCase,
    GetJobUseCase,
    CancelJobUseCase,
    StartJobAttemptUseCase,
    FailJobAttemptUseCase,
    CompleteJobUseCase,
    ReconcileJobsUseCase,
    { provide: JOB_REPOSITORY, useClass: DrizzleJobRepository },
  ],
})
export class JobsModule {}
