import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { LIVE_REFRESH_MS } from '@/features/jobs/queries';

import type { ListEmailsQuery } from '@/features/jobs/job';

export const EMAILS_PAGE_SIZE = 10;

export const useSentEmails = (query: ListEmailsQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => api.listEmails(query),
    queryKey: ['emails', query],
    refetchInterval: LIVE_REFRESH_MS,
  });
