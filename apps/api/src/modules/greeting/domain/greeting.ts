import { err, ok } from 'neverthrow'

import { GreetingNameEmptyError } from '@/modules/greeting/domain/greeting.errors.js'

import type { Result } from 'neverthrow'

export function buildGreeting(name: string): Result<string, GreetingNameEmptyError> {
  const trimmed = name.trim()
  return trimmed ? ok(`Hello, ${trimmed}!`) : err(new GreetingNameEmptyError())
}
