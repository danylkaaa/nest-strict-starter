export type SuccessEnvelope<T> = { ok: true; data: T };

/** `details` carries structured, non-sensitive facts about a business error (for example an existing ID). */
export type ErrorDetails = Record<string, unknown>;

export type ErrorBody = { code: string; message: string; details?: ErrorDetails };

export type ErrorEnvelope = { ok: false; error: ErrorBody };

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export function success<T>(data: T): SuccessEnvelope<T> {
  return { data, ok: true };
}

export function failure(code: string, message: string, details?: ErrorDetails): ErrorEnvelope {
  return {
    error: details === undefined ? { code, message } : { code, details, message },
    ok: false,
  };
}
