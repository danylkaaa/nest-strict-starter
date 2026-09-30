import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { err, ok } from 'neverthrow';

import { GreetingNameEmptyError } from '@/modules/greeting/greeting.errors';

import type { GreetingError } from '@/modules/greeting/greeting.errors';
import type { Result } from 'neverthrow';

@Injectable()
export class GreetingService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GreetingService.name);
  }

  greet(name: string): Result<string, GreetingError> {
    const trimmed = name.trim();
    return trimmed ? ok(`Hello, ${trimmed}!`) : err(new GreetingNameEmptyError());
  }
}
