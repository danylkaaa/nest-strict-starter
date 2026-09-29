import { createMock } from '@golevelup/ts-vitest'
import { StreamableFile } from '@nestjs/common'
import { lastValueFrom, of } from 'rxjs'
import { describe, expect, it } from 'vitest'

import { EnvelopeInterceptor } from '@/app/http/envelope.interceptor.js'

import type { CallHandler, ExecutionContext } from '@nestjs/common'

const run = (value: unknown) =>
  lastValueFrom(
    new EnvelopeInterceptor().intercept(
      createMock<ExecutionContext>(),
      createMock<CallHandler>({ handle: () => of(value) }),
    ),
  )

describe('envelope interceptor', () => {
  it('wraps data in an ok envelope', async () => {
    expect(await run({ id: 1 })).toEqual({ ok: true, data: { id: 1 } })
  })

  it('turns an empty result into data: null', async () => {
    expect(await run(undefined)).toEqual({ ok: true, data: null })
  })

  it('keeps falsy values', async () => {
    expect(await run(0)).toEqual({ ok: true, data: 0 })
  })

  it('does not wrap streams', async () => {
    const file = new StreamableFile(Buffer.from('x'))
    expect(await run(file)).toBe(file)
  })
})
