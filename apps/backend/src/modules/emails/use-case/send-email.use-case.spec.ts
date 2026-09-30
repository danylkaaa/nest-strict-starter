import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { EmailDeliveryFailedError } from '@/modules/emails/email.errors.js';
import { SendEmailUseCase } from '@/modules/emails/use-case/send-email.use-case.js';

import type { SentEmail } from '@/modules/emails/email.js';
import type { EmailClient } from '@/modules/emails/ports/email-client.js';
import type { EmailRepository } from '@/modules/emails/ports/email.repository.js';

const input = { body: 'Hello', recipient: 'person@example.com', subject: 'Welcome' };

const setup = (send: EmailClient['send']) => {
  const save = vi.fn<EmailRepository['save']>((email): Promise<SentEmail> =>
    Promise.resolve({ ...email, id: 'eml_1' }),
  );
  const repository: EmailRepository = { list: vi.fn(), save };
  const useCase = new SendEmailUseCase({ send }, repository);
  return { save, useCase };
};

describe('send email use case', () => {
  it('persists the email after successful delivery', async () => {
    const { save, useCase } = setup(() => Promise.resolve(ok({ messageId: 'mock_1' })));
    const result = await useCase.execute({ ...input, deliveryKey: 'key' });
    expect(result.map((email) => email.messageId)).toEqual(ok('mock_1'));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ ...input, deliveryKey: 'key', messageId: 'mock_1' }),
    );
  });

  it('preserves the delivery error and persists nothing on failure', async () => {
    const failure = new EmailDeliveryFailedError();
    const { save, useCase } = setup(() => Promise.resolve(err(failure)));
    const result = await useCase.execute(input);
    expect(result).toEqual(err(failure));
    expect(save).not.toHaveBeenCalled();
  });

  it('can succeed on retry with the same delivery key after a failed attempt', async () => {
    const send = vi
      .fn<EmailClient['send']>()
      .mockResolvedValueOnce(err(new EmailDeliveryFailedError()))
      .mockResolvedValueOnce(ok({ messageId: 'mock_1' }));
    const { save, useCase } = setup(send);
    const first = await useCase.execute({ ...input, deliveryKey: 'key' });
    const second = await useCase.execute({ ...input, deliveryKey: 'key' });
    expect(first.isErr()).toBe(true);
    expect(second.isOk()).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
