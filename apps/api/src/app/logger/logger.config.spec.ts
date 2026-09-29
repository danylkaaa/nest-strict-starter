import { Test } from '@nestjs/testing'
import { CLS_ID, ClsModule, ClsService } from 'nestjs-cls'
import { pino } from 'pino'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createLoggerParams } from '@/app/logger/logger.config.js'

import type { AppConfig } from '@/app/config/app-config.js'

describe('logger config', () => {
  let cls: ClsService
  let lines: string[]
  const stream = { write: (line: string) => lines.push(line) }

  const options = (config: Partial<AppConfig> = {}) =>
    createLoggerParams(cls, { logLevel: 'info', nodeEnv: 'production', ...config }).pinoHttp

  const build = (config?: Partial<AppConfig>) => {
    const { level, mixin } = options(config)
    return pino({ level, mixin }, stream)
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true })],
    }).compile()
    cls = moduleRef.get(ClsService)
  })

  beforeEach(() => {
    lines = []
  })

  it('adds the request id of the current context to every line', () => {
    cls.runWith({ [CLS_ID]: 'req-1' }, () => {
      build().info('inside')
    })
    expect(lines).toHaveLength(1)
    expect(lines.join('')).toContain('"requestId":"req-1"')
  })

  it('omits the request id outside a request', () => {
    build().info('outside')
    expect(lines).toHaveLength(1)
    expect(lines.join('')).not.toContain('requestId')
  })

  it('takes the level from the config', () => {
    expect(build({ logLevel: 'debug' }).level).toBe('debug')
  })

  it('pretty-prints only in development', () => {
    expect(options({ nodeEnv: 'development' }).transport).toEqual({ target: 'pino-pretty' })
    expect(options({ nodeEnv: 'production' }).transport).toBeUndefined()
  })
})
