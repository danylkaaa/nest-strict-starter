import { TASK_TYPES } from '@/features/jobs/job';

import type { TaskType } from '@/features/jobs/job';

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  email: 'Email',
  transit: 'Aircraft report',
  webhook: 'Webhook',
};

export const TASK_TYPE_OPTIONS = TASK_TYPES.map((type) => [type, TASK_TYPE_LABEL[type]] as const);

export const toTaskType = (value: string | null): TaskType | undefined =>
  TASK_TYPES.find((type) => type === value);
