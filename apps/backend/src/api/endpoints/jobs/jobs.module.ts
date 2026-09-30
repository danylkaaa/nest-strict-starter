import { Module } from '@nestjs/common';

import { JobsModule } from '@/modules/jobs/jobs.module.js';

import { JobsController } from './jobs.controller.js';

@Module({ controllers: [JobsController], imports: [JobsModule] })
export class JobsApiModule {}
