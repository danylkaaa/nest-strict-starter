import { ApiError } from '@/shared/api-error';
import { toaster } from '@/shared/ui/toaster';

import { useCancelJob, useRetryJob } from './queries';

import type { Job } from './job';

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Unexpected error, try again';

/** Cancel and retry with toast feedback, shared by the jobs table and the detail page */
export const useJobActions = () => {
  const cancelMutation = useCancelJob();
  const retryMutation = useRetryJob();

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

  return { busy: cancelMutation.isPending || retryMutation.isPending, cancel, retry };
};
