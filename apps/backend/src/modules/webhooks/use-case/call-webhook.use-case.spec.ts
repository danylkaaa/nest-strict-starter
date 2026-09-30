import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { WebhookDeliveryFailedError } from '@/modules/webhooks/webhook.errors.js';

import { CallWebhookUseCase } from './call-webhook.use-case.js';

import type { WebhookClient } from '@/modules/webhooks/ports/webhook-client.js';
import type { WebhookRepository } from '@/modules/webhooks/ports/webhook.repository.js';

const input = {
  deliveryKey: 'webhook-job:1',
  jobId: '11111111-1111-4111-8111-111111111111',
  payload: { hello: 'world' },
  url: 'https://example.com/hook',
};
const receipt = {
  body: { accepted: true, value: 7 },
  requestId: 'mock_1',
  status: 'delivered',
} as const;

const setup = (call: WebhookClient['call']) => {
  const save = vi.fn<WebhookRepository['save']>().mockResolvedValue({ id: 'whc_1' });
  const client: WebhookClient = { call };
  const repository: WebhookRepository = { list: vi.fn(), save };
  return {
    call: vi.spyOn(client, 'call'),
    save,
    useCase: new CallWebhookUseCase(client, repository),
  };
};

describe('call webhook use case', () => {
  it('passes the delivery key to the client and returns the stored call id with the receipt', async () => {
    const { call, save, useCase } = setup(() => Promise.resolve(ok(receipt)));
    const result = await useCase.execute(input);
    expect(result).toEqual(ok({ callId: 'whc_1', receipt }));
    expect(call).toHaveBeenCalledWith(input);
    expect(save).toHaveBeenCalledWith({ jobId: input.jobId, outcome: 'succeeded', receipt });
  });

  it('records a failed attempt and preserves the delivery error', async () => {
    const failure = new WebhookDeliveryFailedError();
    const { save, useCase } = setup(() => Promise.resolve(err(failure)));
    const result = await useCase.execute(input);
    expect(result).toEqual(err(failure));
    expect(save).toHaveBeenCalledWith({
      error: { message: failure.message, name: failure.name },
      jobId: input.jobId,
      outcome: 'failed',
    });
    expect(JSON.stringify(save.mock.calls)).not.toContain('example.com');
  });

  it('lets a storage failure throw for the worker to retry', async () => {
    const { save, useCase } = setup(() => Promise.resolve(ok(receipt)));
    save.mockRejectedValue(new Error('Failed to persist webhook call.'));
    await expect(useCase.execute(input)).rejects.toThrow('Failed to persist webhook call.');
  });
});
