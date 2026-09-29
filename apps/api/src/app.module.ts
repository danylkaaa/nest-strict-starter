import { Module } from '@nestjs/common'

import { GreetingModule } from './modules/greeting/greeting.module.js'

@Module({ imports: [GreetingModule] })
export class AppModule {}
