import { createMock } from '@golevelup/ts-vitest'
import { err, ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import { BadRequestError } from '@/app/http/errors/http-errors.js'
import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js'
import { GreetingNameEmptyError } from '@/modules/greeting/domain/greeting.errors.js'
import { GreetingController } from '@/modules/greeting/presentation/greeting.controller.js'

const controllerWith = (result: ReturnType<GreetingService['greet']>) =>
  new GreetingController(createMock<GreetingService>({ greet: () => result }))

describe('greeting controller', () => {
  it('returns the greeting as a response dto', () => {
    const controller = controllerWith(ok('Hello, Ada!'))

    expect(controller.greet({ name: 'Ada' })).toEqual(ok({ message: 'Hello, Ada!' }))
  })

  it('passes the query name to the service', () => {
    const service = createMock<GreetingService>({
      greet: () => ok<string, GreetingNameEmptyError>('Hello, Ada!'),
    })

    new GreetingController(service).greet({ name: 'Ada' })

    expect(service.greet).toHaveBeenCalledWith('Ada')
  })

  it('maps a business error to a 400 with the friendly message', () => {
    const controller = controllerWith(err(new GreetingNameEmptyError()))

    const result = controller.greet({ name: ' ' })

    expect(result).toEqual(err(new BadRequestError('Please enter a name.')))
    expect(result).toMatchObject({ error: { statusCode: 400 } })
  })
})
