import { JOB_STATUSES, JOB_TYPES } from './job';

import type { ListJobsQuery } from './job';

export const JOBS_PAGE_SIZE = 10;

/** Reads the jobs list query from the URL, ignoring unknown values */
export const parseJobsFilters = (params: URLSearchParams): ListJobsQuery => {
  const status = JOB_STATUSES.find((value) => value === params.get('status'));
  const type = JOB_TYPES.find((value) => value === params.get('type'));
  const search = params.get('q') ?? '';
  const page = Math.trunc(Number(params.get('page') ?? '1'));
  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize: JOBS_PAGE_SIZE,
    ...(status === undefined ? {} : { status }),
    ...(type === undefined ? {} : { type }),
    ...(search === '' ? {} : { search }),
  };
};
