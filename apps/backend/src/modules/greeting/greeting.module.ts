import { Module } from '@nestjs/common';

import { GreetingService } from './application/services/greeting.service.js';
import { GreetingController } from './presentation/greeting.controller.js';

@Module({
  controllers: [GreetingController],
  providers: [GreetingService],
})
export class GreetingModule {}
