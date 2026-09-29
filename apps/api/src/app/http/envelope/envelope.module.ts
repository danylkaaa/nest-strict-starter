import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { EnvelopeFilter } from '@/app/http/envelope/envelope.filter.js';
import { EnvelopeInterceptor } from '@/app/http/envelope/envelope.interceptor.js';

/** Registers the response envelope globally. Import once, in `AppModule`. */
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: EnvelopeFilter },
  ],
})
export class EnvelopeModule {}
