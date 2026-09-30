import type { Page } from '@/features/jobs/job';

export const paginate = <T>(
  items: readonly T[],
  { page, pageSize }: { page: number; pageSize: number },
): Page<T> => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pageSize,
    total: items.length,
    totalPages,
  };
};
