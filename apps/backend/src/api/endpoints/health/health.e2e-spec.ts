import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AppModule } from '@/api/api.module.js';
import { setupSwagger } from '@/api/core/swagger/swagger.config.js';
import { QueueService } from '@/common/queue/queue.service.js';

import type { INestApplication } from '@nestjs/common';

// Requires a migrated database with the queues created (pnpm run setup).

const countsSchema = z.object({
  cancelled: z.number(),
  completed: z.number(),
  failed: z.number(),
  pending: z.number(),
  processing: z.number(),
  scheduled: z.number(),
});
const checksSchema = z.object({ database: z.enum(['up', 'down']), queue: z.enum(['up', 'down']) });
const okSchema = z.object({
  data: z.object({ checks: checksSchema, counts: countsSchema, status: z.enum(['ok', 'down']) }),
  ok: z.literal(true),
});
const downSchema = z.object({
  error: z.object({
    code: z.string(),
    details: z.object({ checks: checksSchema, counts: countsSchema, status: z.literal('down') }),
    message: z.string(),
  }),
  ok: z.literal(false),
});

describe('health endpoint', () => {
  let api: INestApplication;
  let baseUrl: string;
  let queue: QueueService;

  beforeAll(async () => {
    const apiModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    api = apiModule.createNestApplication({ logger: false });
    api.setGlobalPrefix('api');
    setupSwagger(api);
    await api.listen(0, '127.0.0.1');
    baseUrl = await api.getUrl();
    queue = api.get(QueueService);
  }, 30_000);

  afterAll(async () => {
    await api?.close();
  });

  it('returns 200 with both checks up and real counts', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    const { data } = okSchema.parse(await response.json());
    expect(data.status).toBe('ok');
    expect(data.checks).toEqual({ database: 'up', queue: 'up' });

    const stats = await fetch(`${baseUrl}/api/jobs/stats`);
    const { data: statsData } = z
      .object({ data: z.object({ counts: countsSchema }) })
      .parse(await stats.json());
    expect(data.counts).toEqual(statsData.counts);
  });

  it('returns 503 naming the failed queue check without leaking the error', async () => {
    const spy = vi
      .spyOn(queue.boss, 'getQueue')
      .mockRejectedValue(new Error('secret-connection-detail'));
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(503);
      const body = downSchema.parse(await response.json());
      expect(body.error.details.checks).toEqual({ database: 'up', queue: 'down' });
      expect(JSON.stringify(body)).not.toContain('secret');
    } finally {
      spy.mockRestore();
    }
  });
});
