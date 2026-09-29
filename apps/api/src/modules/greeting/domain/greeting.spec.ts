import { err, ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import { buildGreeting } from './greeting.js'

describe('buildGreeting', () => {
  it('greets by name', () => {
    expect(buildGreeting('Ada')).toEqual(ok('Hello, Ada!'))
  })

  it('rejects a blank name', () => {
    expect(buildGreeting('  ')).toEqual(err({ type: 'NameEmpty' }))
  })
})
