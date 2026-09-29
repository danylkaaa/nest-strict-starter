import { Injectable } from '@nestjs/common'

import { buildGreeting } from '@/modules/greeting/domain/greeting.js'

import type { GreetingError } from '@/modules/greeting/domain/greeting.errors.js'
import type { Result } from 'neverthrow'

@Injectable()
export class GreetingService {
  greet(name: string): Result<string, GreetingError> {
    return buildGreeting(name)
  }
}
