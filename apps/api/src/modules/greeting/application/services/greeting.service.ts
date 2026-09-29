import { Injectable } from '@nestjs/common'

import { buildGreeting } from '@/modules/greeting/domain/greeting.js'

@Injectable()
export class GreetingService {
  greet(name: string): string {
    return buildGreeting(name)
  }
}
