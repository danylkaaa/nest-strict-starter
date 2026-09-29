import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

import { buildGreeting } from '@/modules/greeting/domain/greeting.js'

import type { GreetingError } from '@/modules/greeting/domain/greeting.errors.js'
import type { Result } from 'neverthrow'

@Injectable()
export class GreetingService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GreetingService.name)
  }

  greet(name: string): Result<string, GreetingError> {
    const result = buildGreeting(name)
    this.logger.debug({ ok: result.isOk() }, 'Greeting built')
    return result
  }
}
