import { Logger } from '@nestjs/common';
import { PgBoss } from 'pg-boss';

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export const EMAIL_QUEUE = 'email';
export const WEBHOOK_QUEUE = 'webhook';
export const AIRCRAFT_REPORT_QUEUE = 'aircraft-report';

/** Every queue `pnpm setup` creates and startup verifies; keep `scripts/migrate-queue.mjs` in sync. */
export const QUEUES = [EMAIL_QUEUE, WEBHOOK_QUEUE, AIRCRAFT_REPORT_QUEUE] as const;
export type QueueName = (typeof QUEUES)[number];

export class QueueService implements OnModuleInit, OnModuleDestroy {
  readonly boss: PgBoss;
  private readonly logger = new Logger(QueueService.name);

  constructor(url: string) {
    this.boss = new PgBoss({ connectionString: url, createSchema: false, migrate: false });
    this.boss.on('error', () => {
      this.logger.error('pg-boss connection or maintenance failure');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.boss.start();
      for (const name of QUEUES) {
        if (!(await this.boss.getQueue(name))) {
          throw new Error(
            `Queue ${name} is missing. Run pnpm setup before starting the application.`,
          );
        }
      }
    } catch (error) {
      await this.boss.stop();
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop();
  }
}
