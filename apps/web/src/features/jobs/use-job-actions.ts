import { useNavigate } from 'react-router';

import { newIdempotencyKey } from '@/features/submit/idempotency-key';
import { ApiError } from '@/shared/api-error';
import { shortId } from '@/shared/format';
import { toaster } from '@/shared/ui/toaster';

import { jobPath, toRerunInput } from './job-rules';
import { useCancelJob, useRetryJob, useSubmitJob } from './queries';

import type { Job } from './job';

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Unexpected error, try again';

/** Cancel and retry with toast feedback, shared by the jobs table and the detail page */
export const useJobActions = () => {
  const cancelMutation = useCancelJob();
  const retryMutation = useRetryJob();
  const submitMutation = useSubmitJob();
  const navigate = useNavigate();

  const cancel = (job: Pick<Job, 'id' | 'type'>) => {
    cancelMutation.mutate(job, {
      onError: (error) => {
        toaster.error({ description: errorMessage(error), title: 'Could not cancel job' });
      },
      onSuccess: () => {
        toaster.success({ title: `Cancelled ${job.id}` });
      },
    });
  };

  const retry = (job: Pick<Job, 'id'>) => {
    retryMutation.mutate(job.id, {
      onError: (error) => {
        toaster.error({ description: errorMessage(error), title: 'Could not retry job' });
      },
      onSuccess: () => {
        toaster.success({ title: `Retrying ${job.id}` });
      },
    });
  };

  // Unlike retry, allowed in any state: it creates a new job and leaves the original untouched
  const rerun = (job: Job) => {
    submitMutation.mutate(toRerunInput(job, newIdempotencyKey()), {
      onError: (error) => {
        toaster.error({ description: errorMessage(error), title: 'Could not run again' });
      },
      onSuccess: ({ job: created }) => {
        toaster.success({ title: `Started ${shortId(created.id)}` });
        void navigate(jobPath(created));
      },
    });
  };

  return {
    busy: cancelMutation.isPending || retryMutation.isPending || submitMutation.isPending,
    cancel,
    rerun,
    retry,
  };
};
