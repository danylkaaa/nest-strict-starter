import {
  Badge,
  Button,
  Flex,
  HStack,
  Input,
  Link,
  NativeSelect,
  Table,
  Text,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';

import { formatDate, formatTime } from '@/shared/format';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { PageHeader } from '@/shared/ui/page-header';
import { Pager } from '@/shared/ui/pager';
import { Panel } from '@/shared/ui/panel';

import { REPORTS_PAGE_SIZE, useReports } from './queries';
import { useReportsStore } from './reports-store';

const COLUMNS = ['Route', 'Departure', 'Status', 'Job', 'Tries', 'Finished at'] as const;

export const ReportsPage = () => {
  const { page, search, setPage, setSearch, setStatus, status } = useReportsStore();
  const { data, isError } = useReports({
    page,
    pageSize: REPORTS_PAGE_SIZE,
    ...(search === '' ? {} : { search }),
    ...(status === null ? {} : { status }),
  });
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : ((data?.page ?? 1) - 1) * REPORTS_PAGE_SIZE + 1;
  const to = Math.min((data?.page ?? 1) * REPORTS_PAGE_SIZE, total);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Aircraft reports' }]} />
      <PageHeader
        actions={
          <Button asChild colorPalette="blue">
            <RouterLink to="/submit?type=transit">New report job</RouterLink>
          </Button>
        }
        subtitle="Output of finished aircraft report jobs · open a job to see its map"
        title="Aircraft reports"
      />
      <HStack gap="3">
        <Input
          aria-label="Search job ID or airport"
          bg="bg"
          onChange={(event) => {
            setSearch(event.currentTarget.value);
          }}
          placeholder="Search job ID or airport…"
          value={search}
          w="300px"
        />
        <NativeSelect.Root bg="bg" w="180px">
          <NativeSelect.Field
            aria-label="Status"
            onChange={(event) => {
              const { value } = event.currentTarget;
              setStatus(value === 'generated' || value === 'failed' ? value : null);
            }}
            value={status ?? 'all'}
          >
            <option value="all">All statuses</option>
            <option value="generated">Generated</option>
            <option value="failed">Failed</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text color="fg.muted" ms="auto">
          {total} reports
        </Text>
      </HStack>
      <Panel overflow="hidden" p="0">
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              {COLUMNS.map((column, index) => (
                <Table.ColumnHeader
                  color="fg.muted"
                  fontSize="xs"
                  key={column}
                  letterSpacing="wider"
                  pe={index === COLUMNS.length - 1 ? '5' : undefined}
                  ps={index === 0 ? '5' : undefined}
                  textTransform="uppercase"
                >
                  {column}
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data?.items.map((report) => (
              <Table.Row _hover={{ bg: 'blue.50' }} key={report.jobId}>
                <Table.Cell fontWeight="semibold" ps="5">
                  {report.origin} → {report.destination}
                </Table.Cell>
                <Table.Cell>{formatDate(report.departureAt)}</Table.Cell>
                <Table.Cell>
                  <Badge
                    colorPalette={report.status === 'generated' ? 'green' : 'red'}
                    fontWeight="bold"
                    size="sm"
                    textTransform="uppercase"
                  >
                    {report.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Link asChild color="blue.600" fontFamily="mono" fontSize="xs">
                    <RouterLink to={`/jobs/${report.jobId}`}>{report.jobId}</RouterLink>
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  {report.tries}/{report.maxAttempts}
                </Table.Cell>
                <Table.Cell color="fg.muted" pe="5">
                  {formatTime(report.finishedAt)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {(isError || total === 0) && (
          <Text color="fg.muted" p="8" textAlign="center">
            {isError ? 'Could not load reports.' : 'No reports match.'}
          </Text>
        )}
        <Flex
          align="center"
          bg="gray.50"
          borderTopWidth="1px"
          justify="space-between"
          px="5"
          py="3"
        >
          <Text color="fg.muted">
            Showing {from}–{to} of {total}
          </Text>
          <Pager onChange={setPage} page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} />
        </Flex>
      </Panel>
    </>
  );
};
