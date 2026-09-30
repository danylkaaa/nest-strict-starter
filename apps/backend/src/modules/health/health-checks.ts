import { Inject, Injectable } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { sql } from 'drizzle-orm';

import { EMAIL_QUEUE, QueueService } from '@/common/queue/queue.service.js';

import type { HealthChecks } from './ports/health-checks.js';
import type { Database } from '@workspace/database/client';

@Injectable()
export class DrizzleHealthChecks implements HealthChecks {
  constructor(
    @Inject(getDrizzleToken()) private readonly database: Database,
    private readonly queue: QueueService,
  ) {}

  async pingDatabase(): Promise<void> {
    await this.database.execute(sql`SELECT 1`);
  }

  async pingQueue(): Promise<void> {
    if (!(await this.queue.boss.getQueue(EMAIL_QUEUE))) throw new Error('Queue is missing.');
  }
}
