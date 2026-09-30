import { Box, Button, Flex, HStack, Input, NativeSelect, Text } from '@chakra-ui/react';
import { Link as RouterLink, useSearchParams } from 'react-router';

import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { PageHeader } from '@/shared/ui/page-header';
import { Pager } from '@/shared/ui/pager';
import { Panel } from '@/shared/ui/panel';

import { JobsTable } from './components/jobs-table';
import { JOB_STATUSES, JOB_TYPES } from './job';
import { STATUS_LABEL, TYPE_LABEL } from './job-rules';
import { parseJobsFilters } from './jobs-filters';
import { useJobs } from './queries';

export const JobsPage = () => {
  const [params, setParams] = useSearchParams();
  const query = parseJobsFilters(params);
  const { data, isError } = useJobs(query);

  // Any filter change goes back to page 1; paging keeps the filters
  const update = (key: string, value: string | null) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Jobs' }]} />
      <PageHeader
        actions={
          <Button asChild colorPalette="blue">
            <RouterLink to="/submit">New job</RouterLink>
          </Button>
        }
        title="Jobs"
      />
      <Flex align="center" gap="3" wrap="wrap">
        <HStack gap="1.5">
          {[undefined, ...JOB_STATUSES].map((status) => (
            <Button
              borderRadius="full"
              colorPalette="blue"
              key={status ?? 'all'}
              onClick={() => {
                update('status', status ?? null);
              }}
              size="sm"
              variant={query.status === status ? 'solid' : 'outline'}
            >
              {status === undefined ? 'All' : STATUS_LABEL[status]}
            </Button>
          ))}
        </HStack>
        <HStack gap="2" ms="auto">
          <NativeSelect.Root bg="bg" size="sm" w="150px">
            <NativeSelect.Field
              aria-label="Job type"
              onChange={(event) => {
                update('type', event.currentTarget.value);
              }}
              value={query.type ?? ''}
            >
              <option value="">Type: All</option>
              {JOB_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Input
            aria-label="Search ID or idempotency key"
            bg="bg"
            onChange={(event) => {
              update('q', event.currentTarget.value);
            }}
            placeholder="Search ID or key…"
            size="sm"
            value={query.search ?? ''}
            w="220px"
          />
        </HStack>
      </Flex>
      <Panel overflow="hidden" p="0">
        {isError ? (
          <Text color="fg.error" p="5">
            Could not load jobs.
          </Text>
        ) : (
          <JobsTable full jobs={data?.items ?? []} />
        )}
      </Panel>
      <Flex align="center" justify="space-between">
        <Text color="fg.muted" fontFamily="mono" fontSize="xs">
          GET /jobs?status={query.status ?? 'all'}&amp;type={query.type ?? 'all'} ·{' '}
          {data?.items.length ?? 0} of {data?.total ?? 0}
        </Text>
        {data !== undefined && data.totalPages > 1 && (
          <Box>
            <Pager
              onChange={(page) => {
                update('page', String(page));
              }}
              page={data.page}
              totalPages={data.totalPages}
            />
          </Box>
        )}
      </Flex>
    </>
  );
};
