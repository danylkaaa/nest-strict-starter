import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { toHttpException } from '@/api/core/errors/to-http-exception';
import { ApiEnvelopeResponse } from '@/api/core/swagger/api-envelope-response.js';
import { GreetingService } from '@/modules/greeting/greeting.service';

import { GreetingQueryDto } from './dtos/greeting-query.dto.js';
import { GreetingResponseDto } from './dtos/greeting-response.dto.js';

import type { HttpExceptionClass } from '@/api/core/errors/to-http-exception';
import type { GreetingError } from '@/modules/greeting/greeting.errors';
import type { HttpException } from '@nestjs/common';
import type { Result } from 'neverthrow';

const HTTP_EXCEPTION_FOR = {
  GreetingNameEmptyError: BadRequestException,
} satisfies Record<GreetingError['name'], HttpExceptionClass>;

@ApiTags('greeting')
@Controller('greeting')
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get()
  @ApiOperation({ summary: 'Greet a person by name' })
  @ApiQuery({
    description: 'Name to greet; must contain non-whitespace text.',
    name: 'name',
    required: true,
    type: String,
  })
  @ApiEnvelopeResponse(GreetingResponseDto.Output)
  greet(@Query() query: GreetingQueryDto): Result<GreetingResponseDto, HttpException> {
    return this.greetingService
      .greet(query.name)
      .map((message) => GreetingResponseDto.create({ message }))
      .mapErr((error) => toHttpException(error, HTTP_EXCEPTION_FOR));
  }
}
