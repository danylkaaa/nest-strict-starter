import { Controller, Get, Query } from '@nestjs/common'

import { BadRequestError } from '@/app/http/errors/http-errors.js'
import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js'
import { GreetingResponseDto } from '@/modules/greeting/presentation/greeting-response.dto.js'

import type { HttpError } from '@/app/http/errors/http-errors.js'
import type { GreetingError } from '@/modules/greeting/domain/greeting.errors.js'
import type { Result } from 'neverthrow'

// Record keys make the mapping exhaustive: a new GreetingError fails typecheck until it is mapped.
const HTTP_ERRORS: Record<GreetingError['name'], (message: string) => HttpError> = {
  GreetingNameEmptyError: (message) => new BadRequestError(message),
}

@Controller('greeting')
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get()
  greet(@Query('name') name = 'world'): Result<GreetingResponseDto, HttpError> {
    return this.greetingService
      .greet(name)
      .map((message) => new GreetingResponseDto(message))
      .mapErr((error) => HTTP_ERRORS[error.name](error.message))
  }
}
