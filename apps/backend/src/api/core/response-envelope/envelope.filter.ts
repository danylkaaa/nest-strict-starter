import { Catch, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { toErrorEnvelope } from './to-error-envelope.js';

import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

const SERVER_ERROR = 500;
const MAX_CAUSE_DEPTH = 5;

/** Drizzle and others wrap the real failure in `cause`, which `stack` omits. */
const describeWithCauses = (exception: unknown): string => {
  const parts: string[] = [];
  let current: unknown = exception;
  while (current !== undefined && parts.length < MAX_CAUSE_DEPTH) {
    parts.push(parts.length === 0 ? describe(current) : `Caused by: ${describe(current)}`);
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join('\n');
};

const describe = (value: unknown): string => {
  if (!(value instanceof Error)) return String(value);
  const { code, detail } = value as Error & { code?: unknown; detail?: unknown };
  const extras = [
    typeof code === 'string' && `code=${code}`,
    typeof detail === 'string' && `detail=${detail}`,
  ].filter(Boolean);
  return `${value.stack ?? value.message}${extras.length > 0 ? `\n  ${extras.join(' ')}` : ''}`;
};

/** Turns every thrown value into `{ ok: false, error: { code, message } }`. */
@Catch()
export class EnvelopeFilter implements ExceptionFilter {
  readonly #logger = new Logger(EnvelopeFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = toErrorEnvelope(exception);
    if (status >= SERVER_ERROR) {
      this.#logger.error(describeWithCauses(exception));
    }
    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.reply(host.switchToHttp().getResponse(), body, status);
  }
}
