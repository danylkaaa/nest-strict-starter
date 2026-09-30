import { Module } from '@nestjs/common';

import { GreetingModule } from '@/modules/greeting/greeting.module';

import { GreetingController } from './greeting.controller.js';

@Module({
  controllers: [GreetingController],
  imports: [GreetingModule],
})
export class GreetingApiModule {}
