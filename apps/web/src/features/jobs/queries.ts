import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError } from '@/shared/api-error';

import type { Job, ListJobsQuery, SubmitJobInput } from './job';

// The design promises data "refreshed every second"
export const LIVE_REFRESH_MS = 1000;

export const useJobs = (query: ListJobsQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => api.listJobs(query),
    queryKey: ['jobs', query],
    refetchInterval: LIVE_REFRESH_MS,
  });

export const useJob = (id: string) =>
  useQuery({
    queryFn: () => api.getJob(id),
    queryKey: ['job', id],
    refetchInterval: LIVE_REFRESH_MS,
    // API errors such as NOT_FOUND are answers, not transient failures
    retry: (count, error) => !(error instanceof ApiError) && count < 3,
  });

export const useBatch = (id: string) =>
  useQuery({
    queryFn: () => api.getBatch(id),
    queryKey: ['batch', id],
    refetchInterval: LIVE_REFRESH_MS,
    retry: (count, error) => !(error instanceof ApiError) && count < 3,
  });

export const useBatchActivity = (id: string) =>
  useQuery({
    queryFn: () => api.getBatchActivity(id),
    queryKey: ['batch-activity', id],
    refetchInterval: LIVE_REFRESH_MS,
    retry: (count, error) => !(error instanceof ApiError) && count < 3,
  });

export const useHealth = () =>
  useQuery({ queryFn: api.getHealth, queryKey: ['health'], refetchInterval: LIVE_REFRESH_MS });

export const useAirports = () =>
  useQuery({ queryFn: api.listAirports, queryKey: ['airports'], staleTime: Infinity });

const useInvalidateJobs = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['jobs', 'job', 'batch', 'batch-activity', 'health', 'emails', 'webhooks', 'reports'].map(
        (key) => queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
};

export const useSubmitJob = () => {
  const invalidate = useInvalidateJobs();
  return useMutation({
    mutationFn: (input: SubmitJobInput) => api.submitJob(input),
    onSuccess: invalidate,
  });
};

export const useCancelJob = () => {
  const invalidate = useInvalidateJobs();
  return useMutation({
    // A batch is cancelled through its own endpoint; the job endpoint refuses batch children
    mutationFn: (job: Pick<Job, 'id' | 'type'>) =>
      job.type === 'batch' ? api.cancelBatch(job.id) : api.cancelJob(job.id),
    onSuccess: invalidate,
  });
};

export const useRetryJob = () => {
  const invalidate = useInvalidateJobs();
  return useMutation({ mutationFn: api.retryJob, onSuccess: invalidate });
};
