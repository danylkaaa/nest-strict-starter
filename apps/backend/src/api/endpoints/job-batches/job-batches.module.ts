import { Module } from '@nestjs/common';

import { JobsModule } from '@/modules/jobs/jobs.module.js';

import { JobBatchesController } from './job-batches.controller.js';

@Module({ controllers: [JobBatchesController], imports: [JobsModule] })
export class JobBatchesApiModule {}
