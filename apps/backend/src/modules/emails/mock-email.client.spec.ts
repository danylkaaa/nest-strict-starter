import { setTimeout } from 'node:timers/promises';

import { err, ok } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailDeliveryFailedError } from '@/modules/emails/email.errors.js';
import { MockEmailClient } from '@/modules/emails/mock-email.client.js';

const randomIntMock = vi.hoisted(() => vi.fn<(min: number, max: number) => number>());

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:crypto')>()),
  randomInt: randomIntMock,
}));

const content = { body: 'Hello', recipient: 'person@example.com', subject: 'Welcome' };

const stubFailureRoll = (roll: number) => {
  randomIntMock.mockImplementation((min, max) => (min === 0 && max === 10 ? roll : min));
};

describe('mock email client', () => {
  beforeEach(() => {
    randomIntMock.mockReset();
  });

  it('returns a delivery failure when the 10% roll hits', async () => {
    stubFailureRoll(0);
    const result = await new MockEmailClient().send(content);
    expect(setTimeout).toHaveBeenCalledWith(1000);
    expect(result).toEqual(err(new EmailDeliveryFailedError()));
    expect(
      result.match(
        () => '',
        (error) => error.message,
      ),
    ).not.toContain(content.recipient);
  });

  it('always fails a @bounce.test recipient without exposing it, whatever the roll', async () => {
    stubFailureRoll(1);
    const result = await new MockEmailClient().send({
      ...content,
      recipient: 'Person@Bounce.Test',
    });
    expect(result).toEqual(err(new EmailDeliveryFailedError()));
    expect(JSON.stringify(result)).not.toContain('ounce');
  });

  it('does not fail other recipients that merely mention bounce.test', async () => {
    stubFailureRoll(1);
    const result = await new MockEmailClient().send({
      ...content,
      recipient: 'bounce.test@example.com',
    });
    expect(result.isOk()).toBe(true);
  });

  it('returns a message id otherwise', async () => {
    stubFailureRoll(1);
    const result = await new MockEmailClient().send(content);
    expect(result.map(({ messageId }) => messageId.startsWith('mock_'))).toEqual(ok(true));
  });

  it('returns a stable message id for the same delivery key', async () => {
    stubFailureRoll(1);
    const client = new MockEmailClient();
    const first = await client.send(content, 'email-job:1');
    const second = await client.send(content, 'email-job:1');
    expect(first).toEqual(second);
  });
});
