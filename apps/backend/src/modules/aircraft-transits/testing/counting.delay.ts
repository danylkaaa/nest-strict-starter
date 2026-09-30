import type { SimulationDelay } from '@/modules/aircraft-transits/ports/simulation-delay.js';

export class CountingDelay implements SimulationDelay {
  calls = 0;

  wait() {
    this.calls += 1;
    return Promise.resolve();
  }
}
