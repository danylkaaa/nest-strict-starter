import {
  Badge,
  Button,
  Center,
  Flex,
  HStack,
  Input,
  NativeSelect,
  Spinner,
  Table,
  Text,
} from '@chakra-ui/react';
import { Fragment } from 'react';
import { Link as RouterLink } from 'react-router';

import { useJob } from '@/features/jobs/queries';
import { TransitReportView } from '@/features/jobs/transit/transit-report-view';
import { formatDate, formatTime } from '@/shared/format';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { PageHeader } from '@/shared/ui/page-header';
import { Pager } from '@/shared/ui/pager';
import { Panel } from '@/shared/ui/panel';
import { ShortId } from '@/shared/ui/short-id';

import { REPORTS_PAGE_SIZE, useReports } from './queries';
import { useReportsStore } from './reports-store';

const COLUMNS = ['Route', 'Departure', 'Status', 'Job', 'Tries', 'Finished at'] as const;

// Loads the job only while its row is open and shows the same report as the job page
const ReportDetail = ({ jobId }: { jobId: string }) => {
  const { data } = useJob(jobId);
  if (data === undefined) {
    return (
      <Center py="8">
        <Spinner />
      </Center>
    );
  }
  if (data.type === 'transit' && data.result !== null)
    return <TransitReportView report={data.result} />;
  return (
    <Text color="fg.muted" py="3">
      {data.error ?? 'No report was produced.'}
    </Text>
  );
};

export const ReportsPage = () => {
  const { expandedId, page, search, setPage, setSearch, setStatus, status, toggleExpanded } =
    useReportsStore();
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
        subtitle="Output of finished aircraft report jobs · click a row to see its map, click a job to open it"
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
            {data?.items.map((report) => {
              const expanded = expandedId === report.jobId;
              return (
                <Fragment key={report.jobId}>
                  <Table.Row
                    _hover={{ bg: 'blue.50' }}
                    aria-expanded={expanded}
                    bg={expanded ? 'blue.50' : undefined}
                    cursor="pointer"
                    onClick={() => {
                      toggleExpanded(report.jobId);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleExpanded(report.jobId);
                      }
                    }}
                    tabIndex={0}
                  >
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
                      <ShortId id={report.jobId} to={`/jobs/${report.jobId}`} />
                    </Table.Cell>
                    <Table.Cell>
                      {report.tries}/{report.maxAttempts}
                    </Table.Cell>
                    <Table.Cell color="fg.muted" pe="5">
                      {formatTime(report.finishedAt)}
                    </Table.Cell>
                  </Table.Row>
                  {expanded && (
                    <Table.Row bg="blue.50">
                      <Table.Cell colSpan={COLUMNS.length} pb="5" pt="0" px="5">
                        <ReportDetail jobId={report.jobId} />
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Fragment>
              );
            })}
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
