import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ApiEnvelopeResponse } from '@/api/core/swagger/api-envelope-response.js';
import { ListSentEmailsUseCase } from '@/modules/emails/use-case/list-sent-emails.use-case.js';
import { SendEmailUseCase } from '@/modules/emails/use-case/send-email.use-case.js';

import { ListSentEmailsDto } from './dtos/list-sent-emails.dto.js';
import { SendEmailDto } from './dtos/send-email.dto.js';
import { SentEmailDto } from './dtos/sent-email.dto.js';
import { SentEmailsPageDto } from './dtos/sent-emails-page.dto.js';

import type { Result } from 'neverthrow';

@ApiTags('emails')
@Controller('emails')
export class EmailsController {
  constructor(
    private readonly sendEmail: SendEmailUseCase,
    private readonly listSentEmails: ListSentEmailsUseCase,
  ) {}

  @Post()
  @ApiOperation({
    description: 'Waits 1–3 seconds for mock delivery before persisting the email.',
    summary: 'Simulate sending an email and persist the sent record',
  })
  @ApiBody({ type: SendEmailDto })
  @ApiEnvelopeResponse(SentEmailDto.Output, 201)
  async send(@Body() body: SendEmailDto): Promise<Result<SentEmailDto, never>> {
    const result = await this.sendEmail.execute(body);
    return result.map((email) =>
      SentEmailDto.create({ ...email, sentAt: email.sentAt.toISOString() }),
    );
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
