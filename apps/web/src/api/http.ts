import { z } from 'zod';

import { ApiError } from '@/shared/api-error';

import { errorEnvelopeSchema } from './schemas';

// The only place that talks HTTP. Vite proxies `/api` to the backend in development, so the
// browser sees one origin and needs no CORS.
const BASE_PATH = '/api';

interface RequestOptions {
  body?: unknown;
  method?: 'DELETE' | 'GET' | 'POST';
  query?: Record<string, number | string | undefined>;
}

const toQueryString = (query: RequestOptions['query']): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
};

/** Calls the API and returns the `data` of the success envelope, parsed with `schema` */
export const request = async <Schema extends z.ZodType>(
  schema: Schema,
  path: string,
  { body, method = 'GET', query }: RequestOptions = {},
): Promise<z.output<Schema>> => {
  let response: Response;
  try {
    response = await fetch(`${BASE_PATH}${path}${toQueryString(query)}`, {
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
      method,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'The API is unreachable');
  }
  const json: unknown = await response.json().catch(() => null);
  const failure = errorEnvelopeSchema.safeParse(json);
  if (failure.success) {
    const { code, details, message } = failure.data.error;
    throw new ApiError(code, message, details?.existingJobId);
  }
  const envelope = z.object({ data: z.unknown(), ok: z.literal(true) }).safeParse(json);
  const parsed = envelope.success ? schema.safeParse(envelope.data.data) : undefined;
  if (parsed?.success !== true)
    throw new ApiError('BAD_RESPONSE', 'The API returned an unexpected response');
  return parsed.data;
};
