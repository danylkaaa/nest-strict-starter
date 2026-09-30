/** Shared by every queue: 3 retries, 60 s delay, exponential backoff. */
export const RETRY_POLICY = { retryBackoff: true, retryDelay: 60, retryLimit: 3 } as const;

/** First attempt plus every retry; a failed attempt at this number is terminal. */
export const MAX_ATTEMPTS = RETRY_POLICY.retryLimit + 1;
