import { Logger } from '@nestjs/common';
import { PgBoss } from 'pg-boss';

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export const EMAIL_QUEUE = 'email';

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
      if (!(await this.boss.getQueue(EMAIL_QUEUE))) {
        throw new Error('Email queue is missing. Run pnpm setup before starting the application.');
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
