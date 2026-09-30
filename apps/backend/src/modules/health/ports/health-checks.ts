export const HEALTH_CHECKS = Symbol('HealthChecks');

/** Each method resolves when the dependency answers and rejects when it does not. */
export interface HealthChecks {
  pingDatabase(): Promise<void>;
  pingQueue(): Promise<void>;
}
