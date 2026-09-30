import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { CheckHealthUseCase } from '@/modules/health/use-case/check-health.use-case.js';

import { HealthController } from './health.controller.js';

import type { HealthReport } from '@/modules/health/health.js';

const counts = { cancelled: 0, completed: 4, failed: 1, pending: 2, processing: 3, scheduled: 5 };
const zeros = { cancelled: 0, completed: 0, failed: 0, pending: 0, processing: 0, scheduled: 0 };

const setup = async (report: HealthReport) => {
  const check = vi.fn<CheckHealthUseCase['execute']>().mockResolvedValue(report);
  const module = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: CheckHealthUseCase, useValue: { execute: check } }],
  }).compile();
  return module.get(HealthController);
};

describe('health controller', () => {
  it('returns the report when everything answers', async () => {
    const controller = await setup({
      checks: { database: 'up', queue: 'up' },
      counts,
      status: 'ok',
    });
    await expect(controller.health()).resolves.toEqual({
      checks: { database: 'up', queue: 'up' },
      counts,
      status: 'ok',
    });
  });

  it('answers 503 and names the failed check in the error details', async () => {
    const controller = await setup({
      checks: { database: 'up', queue: 'down' },
      counts,
      status: 'down',
    });
    await expect(controller.health()).rejects.toMatchObject({
      response: {
        code: 'SERVICE_UNAVAILABLE',
        details: { checks: { database: 'up', queue: 'down' }, counts, status: 'down' },
        message: 'A dependency is not answering: queue.',
      },
      status: 503,
    });
  });

  it('lists every failed check in the message', async () => {
    const controller = await setup({
      checks: { database: 'down', queue: 'down' },
      counts: zeros,
      status: 'down',
    });
    await expect(controller.health()).rejects.toMatchObject({
      response: {
        details: { counts: zeros },
        message: 'A dependency is not answering: database, queue.',
      },
      status: 503,
    });
  });
});
