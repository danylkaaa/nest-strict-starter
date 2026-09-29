import { Controller, Get, HttpStatus, Query } from '@nestjs/common'

import { ApiException } from '@/app/http/api-exception.js'
import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js'

import type { GreetingError } from '@/modules/greeting/domain/greeting.js'

// Record keys make the mapping exhaustive: a new GreetingError tag fails typecheck until mapped.
const GREETING_ERRORS: Record<
  GreetingError['type'],
  { status: HttpStatus; code: string; message: string }
> = {
  NameEmpty: {
    status: HttpStatus.BAD_REQUEST,
    code: 'GREETING_NAME_EMPTY',
    message: 'Name must not be empty',
  },
}

function toApiException(error: GreetingError): ApiException {
  const { status, code, message } = GREETING_ERRORS[error.type]
  return new ApiException(status, code, message)
}

@Controller('greeting')
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get()
  greet(@Query('name') name = 'world'): { message: string } {
    return this.greetingService.greet(name).match(
      (message) => ({ message }),
      (error) => {
        throw toApiException(error)
      },
    )
  }
}
