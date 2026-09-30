import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchEmails } from './emails-api';

export const EMAILS_PAGE_SIZE = 10;

export const useEmailsPage = (page: number) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => fetchEmails({ page, pageSize: EMAILS_PAGE_SIZE }),
    queryKey: ['emails', { page, pageSize: EMAILS_PAGE_SIZE }],
  });
