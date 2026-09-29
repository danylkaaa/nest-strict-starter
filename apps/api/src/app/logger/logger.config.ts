import { RequestMethod } from '@nestjs/common';

import { redactCensor, redactPaths } from './redaction.config.js';

import type { AppConfig } from '../config/app-config.js';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LogFn, Logger } from 'pino';
import type { Options } from 'pino-http';

/** Nest framework bootstrap loggers whose output is dropped (app, request, and Bootstrap logs stay). */
export const FILTERED_LOG_CONTEXTS: readonly string[] = [
  'RoutesResolver',
  'RouterExplorer',
  'InstanceLoader',
  'NestFactory',
  'NestApplication',
];

/** pino `hooks.logMethod`: skips the call when the log object's `context` is a filtered one. */
function dropFrameworkLogs(this: Logger, args: Parameters<LogFn>, method: LogFn) {
  const [first] = args;
  const context: unknown =
    typeof first === 'object' && first !== null ? Reflect.get(first, 'context') : undefined;
  if (typeof context === 'string' && FILTERED_LOG_CONTEXTS.includes(context)) {
    return;
  }
  method.apply(this, args);
}

type LoggerConfig = Omit<Params, 'pinoHttp'> & { pinoHttp: Options };

export function createLoggerConfig(
  config: Pick<AppConfig, 'LOG_LEVEL' | 'NODE_ENV'>,
): LoggerConfig {
  const nodeEnv = config.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  const logLevel = config.LOG_LEVEL ?? getLogLevel(nodeEnv);

  return {
    // Exclude health check routes (high-frequency; avoid log spam)
    exclude: [{ method: RequestMethod.GET, path: 'health' }],

    pinoHttp: {
      customErrorMessage: (req: IncomingMessage, res: ServerResponse, error: Error) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${error.message}`;
      },

      customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },

      // Drop Nest framework bootstrap chatter (see FILTERED_LOG_CONTEXTS)
      hooks: { logMethod: dropFrameworkLogs },

      level: logLevel,

      // Sensitive field redaction
      redact: {
        censor: redactCensor,
        paths: redactPaths,
      },

      // Serializers: control which fields are included in log output
      serializers: {
        err: (error: Error) => ({
          message: error.message,
          stack: error.stack,
          type: error.constructor.name,
        }),
        req: (req: IncomingMessage & { id?: string; query?: unknown; params?: unknown }) => ({
          id: req.id,
          method: req.method,
          params: req.params,
          query: req.query,
          remoteAddress: req.socket?.remoteAddress,
          remotePort: req.socket?.remotePort,
          url: req.url,
        }),
        res: (res: ServerResponse) => ({
          statusCode: res.statusCode,
        }),
      },

      // Use pino-pretty for human-readable output in development
      ...(isProduction
        ? {}
        : {
            transport: {
              options: {
                colorize: true,
                ignore: 'pid,hostname',
                messageFormat: '{context} | {msg}',
                singleLine: true,
                translateTime: 'HH:MM:ss',
              },
              target: 'pino-pretty',
            },
          }),
    },
  };
}

/**
 * Get the log level for the given environment
 */
function getLogLevel(nodeEnv: AppConfig['NODE_ENV']): string {
  return {
    development: 'debug',
    production: 'info',
    test: 'warn',
  }[nodeEnv];
}
