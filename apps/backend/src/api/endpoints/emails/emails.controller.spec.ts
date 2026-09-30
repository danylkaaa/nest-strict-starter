import { BadGatewayException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { EmailDeliveryFailedError } from '@/modules/emails/email.errors.js';
import { ListSentEmailsUseCase } from '@/modules/emails/use-case/list-sent-emails.use-case.js';
import { SendEmailUseCase } from '@/modules/emails/use-case/send-email.use-case.js';

import { SendEmailDto } from './dtos/send-email.dto.js';
import { EmailsController } from './emails.controller.js';

const body = SendEmailDto.create({
  body: 'Hello',
  recipient: 'person@example.com',
  subject: 'Welcome',
});

const setup = async (execute: SendEmailUseCase['execute']) => {
  const module = await Test.createTestingModule({
    controllers: [EmailsController],
    providers: [
      { provide: SendEmailUseCase, useValue: { execute } },
      { provide: ListSentEmailsUseCase, useValue: { execute: vi.fn() } },
    ],
  }).compile();
  return module.get(EmailsController);
};

describe('emails controller', () => {
  it('serializes a sent email', async () => {
    const sentAt = new Date('2030-01-01T12:00:00Z');
    const controller = await setup(() =>
      Promise.resolve(
        ok({ ...body, id: 'eml_01ARZ3NDEKTSV4RRFFQ69G5FAV', messageId: 'mock_1', sentAt }),
      ),
    );
    const result = await controller.send(body);
    expect(result.map((email) => email.sentAt)).toEqual(ok('2030-01-01T12:00:00.000Z'));
  });

  it('maps a delivery failure to a 502 exception with the error code', async () => {
    const controller = await setup(() => Promise.resolve(err(new EmailDeliveryFailedError())));
    const result = await controller.send(body);
    expect(result.mapErr((error) => error instanceof BadGatewayException)).toEqual(err(true));
    expect(
      result.match(
        () => undefined,
        (error) => error.getResponse(),
      ),
    ).toEqual({
      code: 'EmailDeliveryFailedError',
      message: 'The email could not be delivered. Please try again.',
    });
  });
});
