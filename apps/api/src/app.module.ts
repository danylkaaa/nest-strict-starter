import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'

import { EnvelopeFilter } from '@/app/http/envelope.filter.js'
import { EnvelopeInterceptor } from '@/app/http/envelope.interceptor.js'

import { GreetingModule } from './modules/greeting/greeting.module.js'

@Module({
  imports: [GreetingModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: EnvelopeFilter },
  ],
})
export class AppModule {}
