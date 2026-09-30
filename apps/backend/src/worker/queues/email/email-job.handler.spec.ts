import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { EmailDeliveryFailedError } from '@/modules/emails/email.errors.js';
import { SendEmailUseCase } from '@/modules/emails/use-case/send-email.use-case.js';
import { CompleteJobUseCase } from '@/modules/jobs/use-case/complete-job.use-case.js';
import { FailJobAttemptUseCase } from '@/modules/jobs/use-case/fail-job-attempt.use-case.js';
import { StartJobAttemptUseCase } from '@/modules/jobs/use-case/start-job-attempt.use-case.js';

import { EmailJobHandler } from './email-job.handler.js';

import type { Job } from 'pg-boss';

const data = { body: 'Hello', recipient: 'person@example.com', subject: 'Welcome' };
const sentEmail = { ...data, id: 'eml_1', messageId: 'mock_1', sentAt: new Date() };

const job = (retryCount: number): Job<unknown> => ({
  data,
  expireInSeconds: 60,
  heartbeatSeconds: null,
  id: 'job-1',
  name: 'email',
  retryCount,
  signal: new AbortController().signal,
});

const setup = async (execute: SendEmailUseCase['execute']) => {
  // The use case owns the terminal decision; here the job allows 4 attempts.
  const fail = vi
    .fn<FailJobAttemptUseCase['execute']>()
    .mockImplementation((_id, attempt, _category, deadLetter) =>
      Promise.resolve({ terminal: deadLetter || attempt >= 4 }),
    );
  const complete = vi.fn().mockResolvedValue(undefined);
  const logger = { info: vi.fn(), setContext: vi.fn(), warn: vi.fn() };
  const module = await Test.createTestingModule({
    providers: [
      EmailJobHandler,
      { provide: PinoLogger, useValue: logger },
      { provide: SendEmailUseCase, useValue: { execute } },
      {
        provide: StartJobAttemptUseCase,
        useValue: { execute: vi.fn().mockResolvedValue(undefined) },
      },
      { provide: FailJobAttemptUseCase, useValue: { execute: fail } },
      { provide: CompleteJobUseCase, useValue: { execute: complete } },
    ],
  }).compile();
  return { complete, fail, handler: module.get(EmailJobHandler), logger };
};

describe('email job handler', () => {
  it('completes the job with the sent email id', async () => {
    const { complete, fail, handler } = await setup(() => Promise.resolve(ok(sentEmail)));
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'completed' });
    expect(complete).toHaveBeenCalledWith('job-1', 1, { emailId: 'eml_1' });
    expect(fail).not.toHaveBeenCalled();
  });

  it('records a retryable failed attempt when delivery fails', async () => {
    const { complete, fail, handler, logger } = await setup(() =>
      Promise.resolve(err(new EmailDeliveryFailedError())),
    );
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'failed' });
    expect(fail).toHaveBeenCalledWith('job-1', 1, 'delivery_failed', false);
    expect(complete).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'retry_scheduled' }),
    );
  });

  it('dead-letters a delivery failure on the final attempt', async () => {
    const { fail, handler } = await setup(() =>
      Promise.resolve(err(new EmailDeliveryFailedError())),
    );
    await expect(handler.handle(job(3))).resolves.toEqual({ id: 'job-1', status: 'deadletter' });
    expect(fail).toHaveBeenCalledWith('job-1', 4, 'delivery_failed', false);
  });

  it('keeps treating thrown storage defects as failed attempts', async () => {
    const { fail, handler } = await setup(() => Promise.reject(new Error('db down')));
    await expect(handler.handle(job(0))).resolves.toEqual({ id: 'job-1', status: 'failed' });
    expect(fail).toHaveBeenCalledWith('job-1', 1, 'delivery_or_storage', false);
  });
});
