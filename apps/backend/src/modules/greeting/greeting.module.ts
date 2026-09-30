import { Module } from '@nestjs/common';

import { GreetingService } from './greeting.service.js';

@Module({
  exports: [GreetingService],
  providers: [GreetingService],
})
export class GreetingModule {}
