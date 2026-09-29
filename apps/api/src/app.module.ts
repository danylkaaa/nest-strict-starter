import { Module } from '@nestjs/common'

import { EnvelopeModule } from '@/app/http/envelope/envelope.module.js'
import { ValidationModule } from '@/app/http/validation/validation.module.js'

import { GreetingModule } from './modules/greeting/greeting.module.js'

@Module({ imports: [EnvelopeModule, ValidationModule, GreetingModule] })
export class AppModule {}
