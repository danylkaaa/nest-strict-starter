import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  NativeSelect,
  Table,
  Text,
} from '@chakra-ui/react';
import { Fragment } from 'react';
import { Link as RouterLink } from 'react-router';

import { formatTime } from '@/shared/format';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { KeyValueList } from '@/shared/ui/key-value-list';
import { PageHeader } from '@/shared/ui/page-header';
import { Pager } from '@/shared/ui/pager';
import { Panel } from '@/shared/ui/panel';
import { ShortId } from '@/shared/ui/short-id';

import { WEBHOOKS_PAGE_SIZE, useSentWebhooks } from './queries';
import { useWebhooksStore } from './webhooks-store';

const COLUMNS = ['URL', 'Method', 'Status', 'Job', 'Tries', 'Finished at'] as const;

const displayValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

export const WebhooksPage = () => {
  const { expandedId, page, search, setPage, setSearch, setStatus, status, toggleExpanded } =
    useWebhooksStore();
  const { data, isError } = useSentWebhooks({
    page,
    pageSize: WEBHOOKS_PAGE_SIZE,
    ...(search === '' ? {} : { search }),
    ...(status === null ? {} : { status }),
  });
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : ((data?.page ?? 1) - 1) * WEBHOOKS_PAGE_SIZE + 1;
  const to = Math.min((data?.page ?? 1) * WEBHOOKS_PAGE_SIZE, total);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Webhooks' }]} />
      <PageHeader
        actions={
          <Button asChild colorPalette="blue">
            <RouterLink to="/submit?type=webhook">New webhook job</RouterLink>
          </Button>
        }
        subtitle="Output of finished webhook jobs · click a row to read the request body"
        title="Webhooks"
      />
      <HStack gap="3">
        <Input
          aria-label="Search URL or body"
          bg="bg"
          onChange={(event) => {
            setSearch(event.currentTarget.value);
          }}
          placeholder="Search URL or body…"
          value={search}
          w="300px"
        />
        <NativeSelect.Root bg="bg" w="180px">
          <NativeSelect.Field
            aria-label="Status"
            onChange={(event) => {
              const { value } = event.currentTarget;
              setStatus(value === 'delivered' || value === 'failed' ? value : null);
            }}
            value={status ?? 'all'}
          >
            <option value="all">All statuses</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text color="fg.muted" ms="auto">
          {total} webhooks
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
            {data?.items.map((webhook) => {
              const expanded = expandedId === webhook.jobId;
              return (
                <Fragment key={webhook.jobId}>
                  <Table.Row
                    _hover={{ bg: 'blue.50' }}
                    aria-expanded={expanded}
                    bg={expanded ? 'blue.50' : undefined}
                    cursor="pointer"
                    onClick={() => {
                      toggleExpanded(webhook.jobId);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleExpanded(webhook.jobId);
                      }
                    }}
                    tabIndex={0}
                  >
                    <Table.Cell fontFamily="mono" fontSize="xs" maxW="360px" ps="5" truncate>
                      {webhook.url}
                    </Table.Cell>
                    <Table.Cell>{webhook.method}</Table.Cell>
                    <Table.Cell>
                      <Badge
                        colorPalette={webhook.status === 'delivered' ? 'green' : 'red'}
                        fontWeight="bold"
                        size="sm"
                        textTransform="uppercase"
                      >
                        {webhook.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <ShortId id={webhook.jobId} to={`/jobs/${webhook.jobId}`} />
                    </Table.Cell>
                    <Table.Cell>
                      {webhook.tries}/{webhook.maxAttempts}
                    </Table.Cell>
                    <Table.Cell color="fg.muted" pe="5">
                      {formatTime(webhook.sentAt)}
                    </Table.Cell>
                  </Table.Row>
                  {expanded && (
                    <Table.Row bg="blue.50">
                      <Table.Cell colSpan={COLUMNS.length} pb="5" pt="0" px="5">
                        <Box bg="bg" borderRadius="md" borderWidth="1px" p="4">
                          <Text color="fg.muted" fontSize="sm" mb="2">
                            {webhook.method} {webhook.url}
                          </Text>
                          <KeyValueList
                            items={Object.entries(webhook.body).map(([label, value]) => ({
                              label,
                              mono: true,
                              value: displayValue(value),
                            }))}
                          />
                        </Box>
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
            {isError ? 'Could not load webhooks.' : 'No webhooks match.'}
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
