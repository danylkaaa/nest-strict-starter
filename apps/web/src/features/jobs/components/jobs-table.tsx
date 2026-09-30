import { Box, Button, Table, Text } from '@chakra-ui/react';

import { canCancel, canRetry, displayStatus, jobPath, TYPE_LABEL } from '@/features/jobs/job-rules';
import { useJobActions } from '@/features/jobs/use-job-actions';
import { formatTime } from '@/shared/format';
import { ShortId } from '@/shared/ui/short-id';

import { StatusBadge } from './status-badge';

import type { Job } from '@/features/jobs/job';

interface JobsTableProps {
  /** Full variant adds the progress and action columns used on the Jobs page */
  full?: boolean;
  jobs: readonly Job[];
}

const headerProps = {
  color: 'fg.muted',
  fontSize: 'xs',
  letterSpacing: 'wider',
  textTransform: 'uppercase',
} as const;

export const JobsTable = ({ full = false, jobs }: JobsTableProps) => {
  const { busy, cancel, retry } = useJobActions();
  return (
    <Table.Root size="md">
      <Table.Header>
        <Table.Row bg="gray.50">
          <Table.ColumnHeader {...headerProps} ps="5">
            Job
          </Table.ColumnHeader>
          <Table.ColumnHeader {...headerProps}>Type</Table.ColumnHeader>
          <Table.ColumnHeader {...headerProps}>Status</Table.ColumnHeader>
          <Table.ColumnHeader {...headerProps}>{full ? 'Priority' : 'Pri'}</Table.ColumnHeader>
          <Table.ColumnHeader {...headerProps}>{full ? 'Attempts' : 'Tries'}</Table.ColumnHeader>
          {full && <Table.ColumnHeader {...headerProps}>Progress</Table.ColumnHeader>}
          <Table.ColumnHeader {...headerProps} pe={full ? undefined : '5'}>
            Created
          </Table.ColumnHeader>
          {full && <Table.ColumnHeader pe="5" />}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {jobs.map((job) => (
          <Table.Row _hover={{ bg: 'blue.50' }} key={job.id}>
            <Table.Cell ps="5">
              <ShortId id={job.id} to={jobPath(job)} />
            </Table.Cell>
            <Table.Cell>{TYPE_LABEL[job.type]}</Table.Cell>
            <Table.Cell>
              <StatusBadge status={displayStatus(job)} />
            </Table.Cell>
            <Table.Cell>{job.priority}</Table.Cell>
            <Table.Cell>
              {job.type === 'batch' ? '–' : `${job.attempts}/${job.maxAttempts}`}
            </Table.Cell>
            {full && (
              <Table.Cell w="120px">
                {job.type === 'batch' && (
                  <Box bg="gray.100" borderRadius="full" h="1.5" overflow="hidden">
                    <Box bg="blue.500" h="full" transition="width 0.4s" w={`${job.progress}%`} />
                  </Box>
                )}
              </Table.Cell>
            )}
            <Table.Cell color="fg.muted" pe={full ? undefined : '5'}>
              {formatTime(job.createdAt)}
            </Table.Cell>
            {full && (
              <Table.Cell pe="5" textAlign="end">
                {canCancel(job) && (
                  <Button
                    colorPalette="blue"
                    disabled={busy}
                    onClick={() => {
                      cancel(job);
                    }}
                    size="xs"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                )}
                {canRetry(job) && (
                  <Button
                    colorPalette="blue"
                    disabled={busy}
                    onClick={() => {
                      retry(job);
                    }}
                    size="xs"
                    variant="ghost"
                  >
                    Retry
                  </Button>
                )}
              </Table.Cell>
            )}
          </Table.Row>
        ))}
        {jobs.length === 0 && (
          <Table.Row>
            <Table.Cell colSpan={full ? 8 : 6} py="8" textAlign="center">
              <Text color="fg.muted">No jobs match.</Text>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table.Root>
  );
};
