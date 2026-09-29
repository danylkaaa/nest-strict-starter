import { randomUUID } from 'node:crypto'

import type { AppConfig } from '@/app/config/app-config.js'
import type { ClsService } from 'nestjs-cls'
import type { Options } from 'pino-http'

/** Builds the nestjs-pino params. Every log line gets `requestId` from the nestjs-cls context. */
export function createLoggerParams(
  cls: ClsService,
  config: Pick<AppConfig, 'logLevel' | 'nodeEnv'>,
): { pinoHttp: Options } {
  return {
    pinoHttp: {
      level: config.logLevel,
      mixin: () => (cls.isActive() ? { requestId: cls.getId() } : {}),
      // Make the id pino-http puts on `req.id` the same one as `requestId`
      genReqId: () => (cls.isActive() ? cls.getId() : randomUUID()),
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      transport: config.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  }
}
