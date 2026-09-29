import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js';
import { GreetingQueryDto } from '@/modules/greeting/presentation/dtos/greeting-query.dto.js';
import { GreetingResponseDto } from '@/modules/greeting/presentation/dtos/greeting-response.dto.js';

import type { HttpException } from '@nestjs/common';
import type { Result } from 'neverthrow';

@Controller('greeting')
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get()
  greet(@Query() query: GreetingQueryDto): Result<GreetingResponseDto, HttpException> {
    return this.greetingService
      .greet(query.name)
      .map((message) => GreetingResponseDto.create({ message }))
      .mapErr((error) => new BadRequestException({ code: error.name, message: error.message }));
  }
}
