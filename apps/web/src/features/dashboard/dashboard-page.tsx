import { Box, Button, Circle, Flex, Grid, HStack, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';

import { JobsTable } from '@/features/jobs/components/jobs-table';
import { JOB_STATUSES } from '@/features/jobs/job';
import { STATUS_LABEL } from '@/features/jobs/job-rules';
import { useHealth, useJobs } from '@/features/jobs/queries';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { PageHeader } from '@/shared/ui/page-header';
import { Panel } from '@/shared/ui/panel';

const STAT_COLOR = {
  cancelled: 'gray.300',
  completed: 'green.500',
  failed: 'red.500',
  pending: 'gray.400',
  processing: 'blue.500',
  scheduled: 'purple.500',
} as const;

const RECENT_JOBS = 6;

export const DashboardPage = () => {
  const health = useHealth();
  const recent = useJobs({ page: 1, pageSize: RECENT_JOBS });
  const counts = health.data?.counts;

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Dashboard' }]} />
      <PageHeader
        actions={
          <Button asChild colorPalette="blue">
            <RouterLink to="/submit">New job</RouterLink>
          </Button>
        }
        subtitle="Queue statistics"
        title="Dashboard"
      />
      <Grid gap="4" templateColumns="repeat(6, 1fr)">
        {JOB_STATUSES.map((status) => (
          <Panel key={status} px="4">
            <Text color="fg.muted" fontSize="sm" fontWeight="medium">
              {STATUS_LABEL[status]}
            </Text>
            <Text fontSize="3xl" fontWeight="bold" lineHeight="1.3">
              {counts?.[status] ?? '–'}
            </Text>
            <Box bg={STAT_COLOR[status]} borderRadius="full" h="1" mt="1" w="40%" />
          </Panel>
        ))}
      </Grid>
      <Grid alignItems="start" gap="5" templateColumns="minmax(0, 2fr) minmax(0, 1fr)">
        <Panel overflow="hidden" p="0">
          <Text fontSize="md" fontWeight="semibold" px="5" py="4">
            Recent jobs
          </Text>
          <JobsTable jobs={recent.data?.items ?? []} />
        </Panel>
        <Panel title="Queue health">
          <HStack gap="2" mb="2">
            <Circle bg={health.data?.healthy === false ? 'red.500' : 'green.500'} size="2.5" />
            <Text fontWeight="bold">{health.data?.healthy === false ? 'Degraded' : 'Healthy'}</Text>
            <Text color="fg.muted" fontSize="sm">
              API, database and queue reachable
            </Text>
          </HStack>
          <Stack gap="0">
            {(
              [
                ['Pending', counts?.pending],
                ['Scheduled', counts?.scheduled],
                ['Processing', counts?.processing],
              ] as const
            ).map(([label, value]) => (
              <Flex borderTopWidth="1px" justify="space-between" key={label} py="2">
                <Text color="fg.muted">{label}</Text>
                <Text fontWeight="bold">{value ?? '–'}</Text>
              </Flex>
            ))}
          </Stack>
        </Panel>
      </Grid>
    </>
  );
};
