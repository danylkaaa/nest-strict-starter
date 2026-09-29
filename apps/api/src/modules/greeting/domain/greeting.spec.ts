import { describe, expect, it } from 'vitest'

import { buildGreeting } from './greeting.js'

describe('buildGreeting', () => {
  it('greets by name', () => {
    expect(buildGreeting('Ada')).toBe('Hello, Ada!')
  })
})
