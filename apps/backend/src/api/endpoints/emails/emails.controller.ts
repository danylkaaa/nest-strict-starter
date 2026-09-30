import { BadGatewayException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { toHttpException } from '@/api/core/errors/to-http-exception.js';
import {
  ApiEnvelopeResponse,
  ApiErrorEnvelopeResponse,
} from '@/api/core/swagger/api-envelope-response.js';
import { ListSentEmailsUseCase } from '@/modules/emails/use-case/list-sent-emails.use-case.js';
import { SendEmailUseCase } from '@/modules/emails/use-case/send-email.use-case.js';

import { ListSentEmailsDto } from './dtos/list-sent-emails.dto.js';
import { SendEmailDto } from './dtos/send-email.dto.js';
import { SentEmailDto } from './dtos/sent-email.dto.js';
import { SentEmailsPageDto } from './dtos/sent-emails-page.dto.js';

import type { HttpExceptionClass } from '@/api/core/errors/to-http-exception.js';
import type { EmailDeliveryFailedError } from '@/modules/emails/email.errors.js';
import type { HttpException } from '@nestjs/common';
import type { Result } from 'neverthrow';

const HTTP_EXCEPTION_FOR = {
  EmailDeliveryFailedError: BadGatewayException,
} satisfies Record<EmailDeliveryFailedError['name'], HttpExceptionClass>;

@ApiTags('emails')
@Controller('emails')
export class EmailsController {
  constructor(
    private readonly sendEmail: SendEmailUseCase,
    private readonly listSentEmails: ListSentEmailsUseCase,
  ) {}

  @Post()
  @ApiOperation({
    description:
      'Waits 1–3 seconds for mock delivery before persisting the email. About 10% of mock deliveries fail with 502 and persist nothing.',
    summary: 'Simulate sending an email and persist the sent record',
  })
  @ApiBody({ type: SendEmailDto })
  @ApiEnvelopeResponse(SentEmailDto.Output, 201)
  @ApiErrorEnvelopeResponse(502, 'The email could not be delivered; nothing was stored.')
  async send(@Body() body: SendEmailDto): Promise<Result<SentEmailDto, HttpException>> {
    const result = await this.sendEmail.execute(body);
    return result
      .map((email) => SentEmailDto.create({ ...email, sentAt: email.sentAt.toISOString() }))
      .mapErr((error) => toHttpException(error, HTTP_EXCEPTION_FOR));
  }

  @Get()
  @ApiOperation({ summary: 'List sent emails in descending email ID order' })
  @ApiQuery({
    description: 'Exclusive eml_<ULID> cursor from nextCursor; omit for the first page.',
    name: 'cursor',
    required: false,
    schema: { pattern: '^eml_[0-7][0-9A-HJKMNP-TV-Z]{25}$', type: 'string' },
  })
  @ApiQuery({
    description: 'Maximum records per page.',
    name: 'limit',
    required: false,
    schema: { default: 20, maximum: 100, minimum: 1, type: 'integer' },
  })
  @ApiEnvelopeResponse(SentEmailsPageDto.Output)
  async list(@Query() query: ListSentEmailsDto): Promise<Result<SentEmailsPageDto, never>> {
    const result = await this.listSentEmails.execute(query);
    return result.map((page) =>
      SentEmailsPageDto.create({
        items: page.items.map((email) => ({ ...email, sentAt: email.sentAt.toISOString() })),
        nextCursor: page.nextCursor,
      }),
    );
  }
}
