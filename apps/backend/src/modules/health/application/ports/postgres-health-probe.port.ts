import type { PostgresUnavailableError } from '@/modules/health/domain/health.errors.js';
import type { ResultAsync } from 'neverthrow';

export const POSTGRES_HEALTH_PROBE = Symbol('POSTGRES_HEALTH_PROBE');

export interface PostgresHealthProbePort {
  check(): ResultAsync<true, PostgresUnavailableError>;
}
