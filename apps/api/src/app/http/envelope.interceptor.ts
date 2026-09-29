import { Injectable, StreamableFile } from '@nestjs/common'
import { map } from 'rxjs'

import { success } from '@/app/http/envelope.js'

import type { ApiEnvelope } from '@/app/http/envelope.js'
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'

/** Wraps every successful handler result in `{ ok: true, data }`. Streams pass through. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        map((data: unknown): ApiEnvelope<unknown> | StreamableFile =>
          data instanceof StreamableFile ? data : success(data ?? null),
        ),
      )
  }
}
