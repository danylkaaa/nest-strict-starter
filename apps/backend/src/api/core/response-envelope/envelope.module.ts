import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { EnvelopeFilter } from './envelope.filter.js';
import { EnvelopeInterceptor } from './envelope.interceptor.js';

@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: EnvelopeFilter },
  ],
})
export class EnvelopeModule {}
