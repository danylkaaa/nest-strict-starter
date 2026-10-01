/** Attempts a job gets when the submission does not choose a limit (first attempt plus 3 retries). */
export const DEFAULT_MAX_ATTEMPTS = 4;

/** Upper bound a submission may choose; a retry can raise a stored job's limit beyond it. */
export const MAX_ATTEMPTS_LIMIT = 10;

/** Base delay for pg-boss exponential retry backoff, in seconds. */
const RETRY_DELAY_SECONDS = 5;
const RETRY_DELAY_MAX_SECONDS = 60;

/**
 * Heartbeat interval passed to pg-boss `send`, in seconds (pg-boss requires at least 10). A
 * worker that stops refreshing it, for example after a crash, is detected after about this long
 * and the job is retried, instead of waiting for the 15 minute default expiry. Workers refresh the
 * heartbeat automatically, every `heartbeatSeconds / 2` (15) seconds by default.
 */
export const HEARTBEAT_SECONDS = 30;

/**
 * Shared by every queue: pg-boss applies exponential retry backoff with jitter, capped at
 * sixty seconds. The job's own `maxAttempts` (first attempt plus retries) sets pg-boss
 * `retryLimit = maxAttempts - 1`.
 */
export const retryPolicy = (maxAttempts: number) =>
  ({
    retryBackoff: true,
    retryDelay: RETRY_DELAY_SECONDS,
    retryDelayMax: RETRY_DELAY_MAX_SECONDS,
    retryLimit: maxAttempts - 1,
  }) as const;
