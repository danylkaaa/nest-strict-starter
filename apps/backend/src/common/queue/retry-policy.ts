/** Attempts a job gets when the submission does not choose a limit (first attempt plus 3 retries). */
export const DEFAULT_MAX_ATTEMPTS = 4;

/** Upper bound a submission may choose; a retry can raise a stored job's limit beyond it. */
export const MAX_ATTEMPTS_LIMIT = 10;

/**
 * Shared by every queue: 60 s delay with exponential backoff. The job's own `maxAttempts` (first
 * attempt plus retries) sets pg-boss `retryLimit = maxAttempts - 1`.
 */
export const retryPolicy = (maxAttempts: number) =>
  ({ retryBackoff: true, retryDelay: 60, retryLimit: maxAttempts - 1 }) as const;
