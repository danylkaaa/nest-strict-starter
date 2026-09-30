import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { QueueService } from './queue.service.js';

describe('queueService', () => {
  it('refuses startup when setup has not created the email queue', async () => {
    const queue = new QueueService('postgresql://test:secret@localhost:5432/test');
    const start = vi.spyOn(queue.boss, 'start').mockResolvedValue(queue.boss);
    const getQueue = vi.spyOn(queue.boss, 'getQueue').mockResolvedValue(null);
    const stop = vi.spyOn(queue.boss, 'stop').mockResolvedValue(undefined);

    await expect(queue.onModuleInit()).rejects.toThrow('Email queue is missing');
    expect(start).toHaveBeenCalledOnce();
    expect(getQueue).toHaveBeenCalledWith('email');
    expect(stop).toHaveBeenCalledOnce();
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
