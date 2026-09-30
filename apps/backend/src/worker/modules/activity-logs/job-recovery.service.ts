import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { ReconcileJobsUseCase } from '@/modules/jobs/use-case/reconcile-jobs.use-case.js';

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class JobRecoveryService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly reconcile: ReconcileJobsUseCase,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(JobRecoveryService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.reconcile.execute();
    this.timer = setInterval(() => {
      void this.reconcile.execute().catch(() => {
        this.logger.error('Job recovery failed; will retry on the next pass.');
      });
    }, 5000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
