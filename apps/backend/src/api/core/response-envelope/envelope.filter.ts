import { Catch, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { toErrorEnvelope } from './to-error-envelope.js';

import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

const SERVER_ERROR = 500;

/** Turns every thrown value into `{ ok: false, error: { code, message } }`. */
@Catch()
export class EnvelopeFilter implements ExceptionFilter {
  readonly #logger = new Logger(EnvelopeFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = toErrorEnvelope(exception);
    if (status >= SERVER_ERROR) {
      this.#logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.reply(host.switchToHttp().getResponse(), body, status);
  }
}
