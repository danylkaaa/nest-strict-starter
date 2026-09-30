import { Box, Stack, Text } from '@chakra-ui/react';

import { TYPE_LABEL } from '@/features/jobs/job-rules';
import { useAirports } from '@/features/jobs/queries';
import { taskFormFromSpec } from '@/features/submit/submit-form';
import { TaskFields } from '@/features/submit/task-fields';

import type { Job } from '@/features/jobs/job';

/** A job's payload rendered with the submit form's fields, read-only */
export const PayloadView = ({ job }: { job: Job }) => {
  const airports = useAirports();
  const airportOptions = (airports.data ?? []).map(
    (airport) => [airport.code, `${airport.code} · ${airport.city}`] as const,
  );

  if (job.type !== 'batch') {
    return (
      <Stack gap="3">
        <TaskFields airportOptions={airportOptions} task={taskFormFromSpec(job, job.id)} />
      </Stack>
    );
  }

  return (
    <Stack gap="3">
      {job.payload.items.map((task, index) => (
        // Tasks are identified by their position in the batch
        <Box
          bg="gray.50"
          borderRadius="md"
          borderWidth="1px"
          key={`task-${String(index + 1)}`}
          p="4"
        >
          <Text fontWeight="semibold" mb="3">
            Task {index + 1} · {TYPE_LABEL[task.type]}
            {job.batchItems[index] !== undefined && (
              <Text as="span" color="fg.muted" fontWeight="normal">
                {' '}
                · {job.batchItems[index]}
              </Text>
            )}
          </Text>
          <Stack gap="3">
            <TaskFields
              airportOptions={airportOptions}
              task={taskFormFromSpec(task, `${job.id}-${String(index)}`)}
            />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};
