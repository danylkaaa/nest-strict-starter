import { Controller, Get, Query } from '@nestjs/common'

import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js'

@Controller('greeting')
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get()
  greet(@Query('name') name = 'world'): { message: string } {
    return { message: this.greetingService.greet(name) }
  }
}
