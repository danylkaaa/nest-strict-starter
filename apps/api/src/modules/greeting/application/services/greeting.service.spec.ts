import { createMock } from '@golevelup/ts-vitest'
import { err, ok } from 'neverthrow'
import { beforeEach, describe, expect, it } from 'vitest'

import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js'
import { GreetingNameEmptyError } from '@/modules/greeting/domain/greeting.errors.js'

import type { PinoLogger } from 'nestjs-pino'

describe('greeting service', () => {
  let logger: PinoLogger
  let service: GreetingService

  beforeEach(() => {
    logger = createMock<PinoLogger>()
    service = new GreetingService(logger)
  })

  it('sets its own logger context', () => {
    expect(logger.setContext).toHaveBeenCalledWith('GreetingService')
  })

  it('returns the greeting for a valid name', () => {
    expect(service.greet('Ada')).toEqual(ok('Hello, Ada!'))
  })

  it('returns the domain error for a blank name', () => {
    expect(service.greet(' ')).toEqual(err(new GreetingNameEmptyError()))
  })

  it('logs the outcome without the name', () => {
    service.greet('Ada')

    expect(logger.debug).toHaveBeenCalledWith({ ok: true }, 'Greeting built')
  })
})
