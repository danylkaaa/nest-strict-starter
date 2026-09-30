import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { CompleteJobUseCase } from '@/modules/jobs/use-case/complete-job.use-case.js';
import { FailJobAttemptUseCase } from '@/modules/jobs/use-case/fail-job-attempt.use-case.js';
import { StartJobAttemptUseCase } from '@/modules/jobs/use-case/start-job-attempt.use-case.js';
import { CallWebhookUseCase } from '@/modules/webhooks/use-case/call-webhook.use-case.js';
import { WebhookDeliveryFailedError } from '@/modules/webhooks/webhook.errors.js';

import { WebhookJobHandler } from './webhook-job.handler.js';

import type { Job } from 'pg-boss';

const data = { payload: { secret: 'payload-value' }, url: 'https://example.com/private-hook' };
const receipt = {
  body: { accepted: true, value: 7 },
  requestId: 'mock_1',
  status: 'delivered',
} as const;

const job = (retryCount: number, jobData: unknown = data): Job<unknown> => ({
  data: jobData,
  expireInSeconds: 60,
  heartbeatSeconds: null,
  id: 'job-1',
  name: 'webhook',
  retryCount,
  signal: new AbortController().signal,
});

const setup = async (execute: CallWebhookUseCase['execute']) => {
  // The use case owns the terminal decision; here the job allows 4 attempts.
  const fail = vi
    .fn<FailJobAttemptUseCase['execute']>()
    .mockImplementation((_id, attempt, _category, deadLetter) =>
      Promise.resolve({ terminal: deadLetter || attempt >= 4 }),
    );
  const complete = vi.fn().mockResolvedValue(undefined);
  const start = vi.fn().mockResolvedValue(undefined);
  const logger = { info: vi.fn(), setContext: vi.fn(), warn: vi.fn() };
  const module = await Test.createTestingModule({
    providers: [
      WebhookJobHandler,
      { provide: PinoLogger, useValue: logger },
      { provide: CallWebhookUseCase, useValue: { execute } },
      { provide: StartJobAttemptUseCase, useValue: { execute: start } },
      { provide: FailJobAttemptUseCase, useValue: { execute: fail } },
      { provide: CompleteJobUseCase, useValue: { execute: complete } },
    ],
  }).compile();
  return { complete, fail, handler: module.get(WebhookJobHandler), logger, start };
};

describe('webhook job handler', () => {
  it('calls the webhook with the job delivery key and completes with the call id', async () => {
    const execute = vi
      .fn<CallWebhookUseCase['execute']>()
      .mockResolvedValue(ok({ callId: 'whc_1', receipt }));
    const { complete, fail, handler, start } = await setup(execute);
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'completed' });
    expect(start).toHaveBeenCalledWith('job-1', 1);
    expect(execute).toHaveBeenCalledWith({
      deliveryKey: 'webhook-job:job-1',
      jobId: 'job-1',
      method: 'POST',
      ...data,
    });
    expect(complete).toHaveBeenCalledWith('job-1', 1, { webhookCallId: 'whc_1' });
    expect(fail).not.toHaveBeenCalled();
  });

  it('dead-letters an invalid payload without calling the webhook', async () => {
    const execute = vi.fn<CallWebhookUseCase['execute']>();
    const { fail, handler, logger } = await setup(execute);
    await expect(handler.handle(job(0, { url: 'not a url' }))).resolves.toEqual({
      id: 'job-1',
      status: 'deadletter',
    });
    expect(execute).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith('job-1', 1, 'invalid_payload', true);
    expect(logger.warn).toHaveBeenCalledWith({
      attempt: 1,
      jobId: 'job-1',
      outcome: 'invalid_payload',
      queue: 'webhook',
    });
  });

  it('records a retryable delivery_failed attempt', async () => {
    const { complete, fail, handler, logger } = await setup(() =>
      Promise.resolve(err(new WebhookDeliveryFailedError())),
    );
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'failed' });
    expect(fail).toHaveBeenCalledWith('job-1', 1, 'delivery_failed', false);
    expect(complete).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'retry_scheduled', queue: 'webhook' }),
    );
  });

  it('dead-letters a delivery failure on the final attempt', async () => {
    const { fail, handler } = await setup(() =>
      Promise.resolve(err(new WebhookDeliveryFailedError())),
    );
    await expect(handler.handle(job(3))).resolves.toEqual({ id: 'job-1', status: 'deadletter' });
    expect(fail).toHaveBeenCalledWith('job-1', 4, 'delivery_failed', false);
  });

  it('treats a thrown error as a retryable delivery_or_storage failure', async () => {
    const { fail, handler } = await setup(() => Promise.reject(new Error('db down')));
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'failed' });
    expect(fail).toHaveBeenCalledWith('job-1', 1, 'delivery_or_storage', false);
  });

  it('never logs the URL or payload', async () => {
    const { handler, logger } = await setup(() =>
      Promise.resolve(err(new WebhookDeliveryFailedError())),
    );
    await handler.handle(job(0));
    await handler.handle(job(0, { url: 'nope' }));
    const logged = JSON.stringify([...logger.info.mock.calls, ...logger.warn.mock.calls]);
    expect(logged).not.toContain('private-hook');
    expect(logged).not.toContain('payload-value');
  });
});
