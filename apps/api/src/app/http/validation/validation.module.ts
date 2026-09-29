import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'

/**
 * Validates every `@Body()`, `@Query()` and `@Param()` typed with a zod DTO class.
 * Failures raise `ZodValidationException`, which `EnvelopeFilter` renders as `VALIDATION_FAILED`.
 * Import once, in `AppModule`.
 */
@Module({ providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }] })
export class ValidationModule {}
