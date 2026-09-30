import { NOW } from './fixtures.js';

import type { Clock } from '@/modules/aircraft-transits/ports/clock.js';

export class FixedClock implements Clock {
  constructor(private readonly current: Date = NOW) {}

  now() {
    return this.current;
  }
}
