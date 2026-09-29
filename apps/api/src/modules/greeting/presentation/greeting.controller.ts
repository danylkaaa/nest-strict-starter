import { Controller, Get, Query } from '@nestjs/common';

import { BadRequestError } from '@/app/http/errors/http-errors.js';
import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js';
import { GreetingQueryDto } from '@/modules/greeting/presentation/dtos/greeting-query.dto.js';
import { GreetingResponseDto } from '@/modules/greeting/presentation/dtos/greeting-response.dto.js';

import type { HttpError } from '@/app/http/errors/http-errors.js';
import type { Result } from 'neverthrow';

@Controller('greeting')
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get()
  greet(@Query() query: GreetingQueryDto): Result<GreetingResponseDto, HttpError> {
    return this.greetingService
      .greet(query.name)
      .map((message) => GreetingResponseDto.create({ message }))
      .mapErr((error) => new BadRequestError(error.message, error.name));
  }
}
