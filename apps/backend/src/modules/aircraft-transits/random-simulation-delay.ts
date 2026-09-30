import { randomInt } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';

import type { SimulationDelay } from './ports/simulation-delay.js';

@Injectable()
export class RandomSimulationDelay implements SimulationDelay {
  async wait(): Promise<void> {
    await setTimeout(randomInt(1000, 3001));
  }
}
