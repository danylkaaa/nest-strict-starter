import { setTimeout } from 'node:timers/promises';

import { err } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MockWebhookClient } from './mock-webhook.client.js';
import { WebhookDeliveryFailedError } from './webhook.errors.js';

const randomIntMock = vi.hoisted(() => vi.fn<(min: number, max: number) => number>());

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:crypto')>()),
  randomInt: randomIntMock,
}));

const input = {
  deliveryKey: 'webhook-job:1',
  jobId: '11111111-1111-4111-8111-111111111111',
  payload: { secret: 'payload-value' },
  url: 'https://example.com/hook',
};

const stubFailureRoll = (roll: number) => {
  randomIntMock.mockImplementation((min, max) => (min === 0 && max === 10 ? roll : min));
};

describe('mock webhook client', () => {
  beforeEach(() => {
    randomIntMock.mockReset();
  });

  it('fails without exposing the URL or payload when the 10% roll hits', async () => {
    stubFailureRoll(0);
    const result = await new MockWebhookClient().call(input);
    expect(setTimeout).toHaveBeenCalledWith(1000);
    expect(result).toEqual(err(new WebhookDeliveryFailedError()));
    expect(JSON.stringify(result)).not.toContain('example.com');
    expect(JSON.stringify(result)).not.toContain('payload-value');
  });

  it('returns the same receipt for the same delivery key', async () => {
    stubFailureRoll(1);
    const client = new MockWebhookClient();
    const first = await client.call(input);
    const second = await client.call(input);
    expect(first.isOk()).toBe(true);
    expect(first).toEqual(second);
    expect(first.unwrapOr(null)?.requestId).toMatch(/^mock_/u);
  });

  it('returns a different receipt for another delivery key', async () => {
    stubFailureRoll(1);
    const client = new MockWebhookClient();
    const first = await client.call(input);
    const second = await client.call({ ...input, deliveryKey: 'webhook-job:2' });
    expect(first).not.toEqual(second);
  });

  it('keeps the receipt body value within 0 to 999999', async () => {
    stubFailureRoll(1);
    const receipt = (await new MockWebhookClient().call(input)).unwrapOr(null);
    expect(receipt?.body.accepted).toBe(true);
    expect(receipt?.body.value).toBeGreaterThanOrEqual(0);
    expect(receipt?.body.value).toBeLessThan(1_000_000);
  });
});
