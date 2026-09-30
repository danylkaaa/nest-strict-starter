import { createMockServer } from './mock-server';
import { seededRandom } from './random';

const TICK_MS = 1000;
const WORKERS = 3;
const SEED = 42;

// Single in-browser server instance for batch jobs, the only job type the backend does not serve.
// It starts empty: batches appear only when the user submits one. The simulated workers advance
// once per second.
export const mockServer = createMockServer({
  now: Date.now,
  random: seededRandom(SEED),
  workers: WORKERS,
});
setInterval(mockServer.tick, TICK_MS);
