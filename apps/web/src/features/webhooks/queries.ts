import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { LIVE_REFRESH_MS } from '@/features/jobs/queries';

import type { ListWebhooksQuery } from '@/features/jobs/job';

export const WEBHOOKS_PAGE_SIZE = 10;

export const useSentWebhooks = (query: ListWebhooksQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => api.listWebhooks(query),
    queryKey: ['webhooks', query],
    refetchInterval: LIVE_REFRESH_MS,
  });
