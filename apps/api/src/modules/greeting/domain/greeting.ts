import { err, ok } from 'neverthrow'

import type { Result } from 'neverthrow'

export type GreetingError = { type: 'NameEmpty' }

export function buildGreeting(name: string): Result<string, GreetingError> {
  const trimmed = name.trim()
  return trimmed ? ok(`Hello, ${trimmed}!`) : err({ type: 'NameEmpty' })
}
