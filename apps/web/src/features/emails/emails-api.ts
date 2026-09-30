import { MOCK_EMAILS } from './mock-emails';

import type { Email, Page, PageParams } from './email';

const SIMULATED_LATENCY_MS = 300;

export const paginate = <T>(items: readonly T[], { page, pageSize }: PageParams): Page<T> => {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
};

// Simulated API: swap the body for a fetch call once the backend endpoint exists.
export const fetchEmails = async (
  params: PageParams,
  latencyMs = SIMULATED_LATENCY_MS,
): Promise<Page<Email>> => {
  await new Promise((resolve) => {
    setTimeout(resolve, latencyMs);
  });
  return paginate(MOCK_EMAILS, params);
};
