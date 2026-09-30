export const SIMULATION_DELAY = Symbol('SimulationDelay');

export interface SimulationDelay {
  wait(): Promise<void>;
}
