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
import { PageHeader } from '@/shared/ui/page-header';
import { Pager } from '@/shared/ui/pager';
import { Panel } from '@/shared/ui/panel';
import { ShortId } from '@/shared/ui/short-id';

import { useEmailsStore } from './emails-store';
import { EMAILS_PAGE_SIZE, useSentEmails } from './queries';

const COLUMNS = ['Message ID', 'To', 'Subject', 'Status', 'Job', 'Tries', 'Sent at'] as const;

export const EmailsPage = () => {
  const { expandedId, page, search, setPage, setSearch, setStatus, status, toggleExpanded } =
    useEmailsStore();
  const { data, isError } = useSentEmails({
    page,
    pageSize: EMAILS_PAGE_SIZE,
    ...(search === '' ? {} : { search }),
    ...(status === null ? {} : { status }),
  });
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (data!.page - 1) * EMAILS_PAGE_SIZE + 1;
  const to = Math.min((data?.page ?? 1) * EMAILS_PAGE_SIZE, total);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Emails' }, { label: 'Sent' }]} />
      <PageHeader
        actions={
          <Button asChild colorPalette="blue">
            <RouterLink to="/submit?type=email">New email job</RouterLink>
          </Button>
        }
        subtitle="Output of completed email jobs · click a row to read it"
        title="Sent emails"
      />
      <HStack gap="3">
        <Input
          aria-label="Search recipient or subject"
          bg="bg"
          onChange={(event) => {
            setSearch(event.currentTarget.value);
          }}
          placeholder="Search recipient or subject…"
          value={search}
          w="300px"
        />
        <NativeSelect.Root bg="bg" w="180px">
          <NativeSelect.Field
            aria-label="Status"
            onChange={(event) => {
              const { value } = event.currentTarget;
              setStatus(value === 'sent' || value === 'failed' ? value : null);
            }}
            value={status ?? 'all'}
          >
            <option value="all">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text color="fg.muted" ms="auto">
          {total} messages
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
            {data?.items.map((email) => {
              const expanded = expandedId === email.jobId;
              return (
                <Fragment key={email.jobId}>
                  <Table.Row
                    _hover={{ bg: 'blue.50' }}
                    aria-expanded={expanded}
                    bg={expanded ? 'blue.50' : undefined}
                    cursor="pointer"
                    onClick={() => {
                      toggleExpanded(email.jobId);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleExpanded(email.jobId);
                      }
                    }}
                    tabIndex={0}
                  >
                    <Table.Cell fontFamily="mono" fontSize="xs" ps="5">
                      {email.messageId ?? '—'}
                    </Table.Cell>
                    <Table.Cell>{email.to}</Table.Cell>
                    <Table.Cell>{email.subject}</Table.Cell>
                    <Table.Cell>
                      <Badge
                        colorPalette={email.status === 'sent' ? 'green' : 'red'}
                        fontWeight="bold"
                        size="sm"
                        textTransform="uppercase"
                      >
                        {email.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <ShortId id={email.jobId} to={`/jobs/${email.jobId}`} />
                    </Table.Cell>
                    <Table.Cell>
                      {email.tries}/{email.maxAttempts}
                    </Table.Cell>
                    <Table.Cell color="fg.muted" pe="5">
                      {formatTime(email.sentAt)}
                    </Table.Cell>
                  </Table.Row>
                  {expanded && (
                    <Table.Row bg="blue.50">
                      <Table.Cell colSpan={COLUMNS.length} pb="5" pt="0" px="5">
                        <Box bg="bg" borderRadius="md" borderWidth="1px" p="4">
                          <Text color="fg.muted" fontSize="sm" mb="2">
                            To {email.to} · {email.subject}
                          </Text>
                          <Text whiteSpace="pre-wrap">{email.body}</Text>
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
            {isError ? 'Could not load emails.' : 'No emails match.'}
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
