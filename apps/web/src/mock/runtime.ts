import { AIRPORTS } from './airports';
import { createSeededMockServer } from './seed';

const TICK_MS = 1000;

// Single in-browser server instance; the simulated workers advance once per second.
export const mockServer = createSeededMockServer(Date.now);
setInterval(mockServer.tick, TICK_MS);

export const mockAirports = AIRPORTS;
