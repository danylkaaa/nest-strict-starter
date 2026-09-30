import { Badge, Box, Grid, Text } from '@chakra-ui/react';

import { formatTime } from '@/shared/format';
import { Panel } from '@/shared/ui/panel';

import type { JobAttempt } from '@/features/jobs/job';

const outcomeBadge = (attempt: JobAttempt) => {
  if (attempt.outcome === null) {
    return attempt.finishedAt === null
      ? { label: 'running', palette: 'blue' }
      : { label: 'stopped', palette: 'gray' };
  }
  return { label: String(attempt.outcome), palette: attempt.outcome >= 400 ? 'red' : 'green' };
};

export const AttemptsPanel = ({ attempts }: { attempts: readonly JobAttempt[] }) => (
  <Panel extra="· backoff 5s → 15s → 45s" title="Attempts">
    {attempts.length === 0 ? (
      <Text color="fg.muted">No attempts yet.</Text>
    ) : (
      <Grid gap="3" templateColumns="repeat(3, 1fr)">
        {attempts.map((attempt, index) => {
          const badge = outcomeBadge(attempt);
          return (
            // A manual retry restarts numbering, so the position is the unique key
            <Box
              borderRadius="md"
              borderWidth="1px"
              key={`${attempt.startedAt}-${String(index)}`}
              p="3"
            >
              <Text color="fg.muted" fontSize="xs" fontWeight="semibold">
                ATTEMPT {attempt.number}
              </Text>
              <Badge colorPalette={badge.palette} fontWeight="bold" my="1.5" size="sm">
                {badge.label}
              </Badge>
              <Text color="fg.muted" fontSize="xs">
                {formatTime(attempt.startedAt)}
                {attempt.next !== null && ` · ${attempt.next}`}
              </Text>
            </Box>
          );
        })}
      </Grid>
    )}
  </Panel>
);
