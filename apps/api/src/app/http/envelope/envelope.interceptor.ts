import { Injectable, StreamableFile } from '@nestjs/common'
import { Err, Ok } from 'neverthrow'
import { map } from 'rxjs'

import { success } from '@/app/http/envelope/envelope.js'

import type { ApiEnvelope } from '@/app/http/envelope/envelope.js'
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'

/**
 * Unwraps the `Result` a controller returns: `Ok` becomes `{ ok: true, data }`, `Err` is thrown
 * so `EnvelopeFilter` renders it. Streams pass through untouched.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown): ApiEnvelope<unknown> | StreamableFile => {
        if (value instanceof Err) throw value.error
        if (value instanceof Ok) return success(value.value ?? null)
        return value instanceof StreamableFile ? value : success(value ?? null)
      }),
    )
  }
}
