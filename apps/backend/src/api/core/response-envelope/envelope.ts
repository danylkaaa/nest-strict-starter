export type SuccessEnvelope<T> = { ok: true; data: T };

export type ErrorBody = { code: string; message: string };

export type ErrorEnvelope = { ok: false; error: ErrorBody };

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export function success<T>(data: T): SuccessEnvelope<T> {
  return { data, ok: true };
}

export function failure(code: string, message: string): ErrorEnvelope {
  return { error: { code, message }, ok: false };
}
