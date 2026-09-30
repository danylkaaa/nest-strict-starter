import { readFileSync } from 'node:fs';

import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { QUEUES, QueueService } from './queue.service.js';

import type { QueueResult } from 'pg-boss';

const existingQueue = (name: string): QueueResult => ({
  activeCount: 0,
  completedDelta: 0,
  createdDelta: 0,
  createdOn: new Date(),
  deferredCount: 0,
  deltaOn: null,
  deltaSeconds: null,
  failedCount: 0,
  failedDelta: 0,
  name,
  queuedCount: 0,
  readyCount: 0,
  singletonsActive: null,
  table: 'job',
  totalCount: 0,
  updatedOn: new Date(),
});

describe('queueService', () => {
  it('refuses startup when setup has not created a queue', async () => {
    const queue = new QueueService('postgresql://test:secret@localhost:5432/test');
    const start = vi.spyOn(queue.boss, 'start').mockResolvedValue(queue.boss);
    const getQueue = vi.spyOn(queue.boss, 'getQueue').mockResolvedValue(null);
    const stop = vi.spyOn(queue.boss, 'stop').mockResolvedValue(undefined);

    await expect(queue.onModuleInit()).rejects.toThrow('Queue email is missing');
    expect(start).toHaveBeenCalledOnce();
    expect(getQueue).toHaveBeenCalledWith('email');
    expect(stop).toHaveBeenCalledOnce();
  });

  it.each([...QUEUES.entries()])(
    'refuses startup at queue %i when only that queue is missing',
    async (index, missing) => {
      const queue = new QueueService('postgresql://test:secret@localhost:5432/test');
      vi.spyOn(queue.boss, 'start').mockResolvedValue(queue.boss);
      const getQueue = vi.spyOn(queue.boss, 'getQueue').mockResolvedValue(null);
      for (const name of QUEUES.slice(0, index))
        getQueue.mockResolvedValueOnce(existingQueue(name));
      const stop = vi.spyOn(queue.boss, 'stop').mockResolvedValue(undefined);

      await expect(queue.onModuleInit()).rejects.toThrow(`Queue ${missing} is missing`);
      expect(getQueue).toHaveBeenCalledWith(missing);
      expect(stop).toHaveBeenCalledOnce();
    },
  );

  it('starts when every queue exists', async () => {
    const queue = new QueueService('postgresql://test:secret@localhost:5432/test');
    vi.spyOn(queue.boss, 'start').mockResolvedValue(queue.boss);
    const getQueue = vi
      .spyOn(queue.boss, 'getQueue')
      .mockImplementation((name) => Promise.resolve(existingQueue(name)));

    await expect(queue.onModuleInit()).resolves.toBeUndefined();
    expect(getQueue.mock.calls.map(([name]) => name)).toEqual([...QUEUES]);
  });

  it('creates the same queues in the setup script', () => {
    const script = readFileSync(
      new URL('../../../scripts/migrate-queue.mjs', import.meta.url),
      'utf8',
    );
    for (const name of QUEUES) expect(script).toContain(`'${name}'`);
  });

  it('handles pg-boss errors without logging database details', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const queue = new QueueService('postgresql://test:secret@localhost:5432/test');
      expect(queue.boss.listenerCount('error')).toBeGreaterThan(0);
      expect(() => queue.boss.emit('error', new Error('secret database parameter'))).not.toThrow();
      expect(error).toHaveBeenCalledWith('pg-boss connection or maintenance failure');
      expect(JSON.stringify(error.mock.calls)).not.toContain('secret database parameter');
    } finally {
      error.mockRestore();
    }
  });
});
