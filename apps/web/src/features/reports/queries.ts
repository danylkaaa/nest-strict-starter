import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { LIVE_REFRESH_MS } from '@/features/jobs/queries';

import type { ListReportsQuery } from '@/features/jobs/job';

export const REPORTS_PAGE_SIZE = 10;

export const useReports = (query: ListReportsQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => api.listReports(query),
    queryKey: ['reports', query],
    refetchInterval: LIVE_REFRESH_MS,
  });
