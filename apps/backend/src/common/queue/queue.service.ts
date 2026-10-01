import { Logger } from '@nestjs/common';
import { PgBoss } from 'pg-boss';

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export const EMAIL_QUEUE = 'email';
export const WEBHOOK_QUEUE = 'webhook';
export const AIRCRAFT_REPORT_QUEUE = 'aircraft-report';

/** Every queue `pnpm setup` creates and startup verifies; keep `scripts/migrate-queue.mjs` in sync. */
export const QUEUES = [EMAIL_QUEUE, WEBHOOK_QUEUE, AIRCRAFT_REPORT_QUEUE] as const;
export type QueueName = (typeof QUEUES)[number];

/** PostgreSQL connection fields pg-boss accepts; a `DatabaseConfig` satisfies it. */
export interface QueueConnection {
  readonly database: string;
  readonly host: string;
  readonly password: string;
  readonly port: number;
  readonly user: string;
}

export class QueueService implements OnModuleInit, OnModuleDestroy {
  readonly boss: PgBoss;
  private readonly logger = new Logger(QueueService.name);

  constructor(connection: QueueConnection) {
    this.boss = new PgBoss({
      createSchema: false,
      database: connection.database,
      host: connection.host,
      migrate: false,
      password: connection.password,
      port: connection.port,
      user: connection.user,
    });
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
