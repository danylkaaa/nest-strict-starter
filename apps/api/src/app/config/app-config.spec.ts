import { describe, expect, it } from 'vitest'

import { AppConfigSchema } from '@/app/config/app-config.js'

describe('app config schema', () => {
  it('applies defaults for an empty environment', () => {
    expect(AppConfigSchema.parse({})).toEqual({
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
    })
  })

  it('maps environment variables to camelCase and coerces the port', () => {
    const config = AppConfigSchema.parse({
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
    })
    expect(config).toEqual({ nodeEnv: 'production', port: 8080, logLevel: 'warn' })
  })

  it('ignores unrelated environment variables', () => {
    expect(AppConfigSchema.parse({ HOME: '/root' })).not.toHaveProperty('HOME')
  })

  it.each([{ PORT: 'abc' }, { PORT: '70000' }, { LOG_LEVEL: 'loud' }, { NODE_ENV: 'staging' }])(
    'rejects invalid input %o',
    (env) => {
      expect(AppConfigSchema.safeParse(env).success).toBe(false)
    },
  )
})
