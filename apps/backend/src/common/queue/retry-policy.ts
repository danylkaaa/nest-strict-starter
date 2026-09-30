/** Attempts a job gets when the submission does not choose a limit (first attempt plus 3 retries). */
export const DEFAULT_MAX_ATTEMPTS = 4;

/** Upper bound a submission may choose; a retry can raise a stored job's limit beyond it. */
export const MAX_ATTEMPTS_LIMIT = 10;

/** Seconds to wait after attempt 1, 2, 3 fails; every later attempt repeats the last value. */
const RETRY_DELAYS_SECONDS = [5, 10, 30] as const;

/**
 * The delay before the next attempt after `attempt` fails. pg-boss cannot express this schedule
 * (its backoff doubles with jitter), so the worker stores this value as the job's fixed
 * `retry_delay` when the attempt starts and pg-boss applies it when the attempt fails, however
 * it fails (handler result, crash, or expiry).
 */
export const retryDelaySeconds = (attempt: number): number =>
  RETRY_DELAYS_SECONDS[Math.min(Math.max(attempt, 1), RETRY_DELAYS_SECONDS.length) - 1] ??
  RETRY_DELAYS_SECONDS[0];

/**
 * Shared by every queue: a fixed pg-boss `retryDelay` (set per attempt, see `retryDelaySeconds`)
 * without backoff. The job's own `maxAttempts` (first attempt plus retries) sets pg-boss
 * `retryLimit = maxAttempts - 1`.
 */
export const retryPolicy = (maxAttempts: number) =>
  ({
    retryBackoff: false,
    retryDelay: retryDelaySeconds(1),
    retryLimit: maxAttempts - 1,
  }) as const;
