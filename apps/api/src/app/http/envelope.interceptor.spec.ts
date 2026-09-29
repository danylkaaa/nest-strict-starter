import { createMock } from '@golevelup/ts-vitest'
import { StreamableFile } from '@nestjs/common'
import { err, ok } from 'neverthrow'
import { lastValueFrom, of } from 'rxjs'
import { describe, expect, it } from 'vitest'

import { EnvelopeInterceptor } from '@/app/http/envelope.interceptor.js'
import { NotFoundError } from '@/app/http/http-errors.js'

import type { CallHandler, ExecutionContext } from '@nestjs/common'

const run = (value: unknown) =>
  lastValueFrom(
    new EnvelopeInterceptor().intercept(
      createMock<ExecutionContext>(),
      createMock<CallHandler>({ handle: () => of(value) }),
    ),
  )

describe('envelope interceptor', () => {
  it('wraps the value of an Ok result in an ok envelope', async () => {
    expect(await run(ok({ id: 1 }))).toEqual({ ok: true, data: { id: 1 } })
  })

  it('turns an empty Ok into data: null', async () => {
    expect(await run(ok())).toEqual({ ok: true, data: null })
  })

  it('throws the error of an Err result', async () => {
    const error = new NotFoundError()
    await expect(run(err(error))).rejects.toBe(error)
  })

  it('still wraps a bare value', async () => {
    expect(await run({ id: 1 })).toEqual({ ok: true, data: { id: 1 } })
  })

  it('does not wrap streams', async () => {
    const file = new StreamableFile(Buffer.from('x'))
    expect(await run(file)).toBe(file)
  })
})
