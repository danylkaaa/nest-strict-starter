import { Injectable } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { QueueService } from '@/common/queue/queue.service.js';

import { JOB_HANDLER } from './job-handler.decorator.js';

import type { OnModuleInit } from '@nestjs/common';
import type { Job, JobResult } from 'pg-boss';

interface Handler {
  handle(job: Job<unknown>): Promise<JobResult>;
}

@Injectable()
export class JobHandlerRegistry implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly queue: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const wrapper of this.discovery.getProviders()) {
      if (!wrapper.metatype || !wrapper.instance) continue;
      const queueName = this.reflector.get<string>(JOB_HANDLER, wrapper.metatype);
      if (!queueName) continue;
      if (!isHandler(wrapper.instance))
        throw new Error(`Job handler for ${queueName} has no handle method.`);
      const handler = wrapper.instance;
      await this.queue.boss.work<unknown>(queueName, { perJobResults: true }, async (jobs) =>
        Promise.all(jobs.map((job) => handler.handle(job))),
      );
    }
  }
}

function isHandler(value: unknown): value is Handler {
  return (
    typeof value === 'object' &&
    value !== null &&
    'handle' in value &&
    typeof value.handle === 'function'
  );
}
