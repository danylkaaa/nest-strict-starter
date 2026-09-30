import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { toHttpException } from '@/app/http/errors/to-http-exception.js';
import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js';
import { GreetingQueryDto } from '@/modules/greeting/presentation/dtos/greeting-query.dto.js';
import { GreetingResponseDto } from '@/modules/greeting/presentation/dtos/greeting-response.dto.js';

import type { HttpExceptionClass } from '@/app/http/errors/to-http-exception.js';
import type { GreetingError } from '@/modules/greeting/domain/greeting.errors.js';
import type { HttpException } from '@nestjs/common';
import type { Result } from 'neverthrow';

const HTTP_EXCEPTION_FOR = {
  GreetingNameEmptyError: BadRequestException,
} satisfies Record<GreetingError['name'], HttpExceptionClass>;

@Controller('greeting')
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get()
  greet(@Query() query: GreetingQueryDto): Result<GreetingResponseDto, HttpException> {
    return this.greetingService
      .greet(query.name)
      .map((message) => GreetingResponseDto.create({ message }))
      .mapErr((error) => toHttpException(error, HTTP_EXCEPTION_FOR));
  }
}
