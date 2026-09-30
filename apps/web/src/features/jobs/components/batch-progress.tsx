import { Box, Flex, Grid, HStack, Progress, Text } from '@chakra-ui/react';

import { TYPE_LABEL } from '@/features/jobs/job-rules';
import { Panel } from '@/shared/ui/panel';

import type { BatchItemStatus, TaskType } from '@/features/jobs/job';

const CELL_STYLE: Record<BatchItemStatus, { bg: string; border: string; color: string }> = {
  done: { bg: 'blue.500', border: 'blue.500', color: 'white' },
  failed: { bg: 'red.100', border: 'red.500', color: 'red.800' },
  queued: { bg: 'bg', border: 'gray.200', color: 'fg.subtle' },
  running: { bg: 'blue.50', border: 'blue.500', color: 'blue.700' },
};

const LEGEND: readonly [BatchItemStatus, string][] = [
  ['done', 'Done'],
  ['running', 'Running'],
  ['failed', 'Failed'],
  ['queued', 'Queued'],
];

export const BatchProgress = ({
  items,
  live,
  progress,
  taskTypes,
}: {
  items: readonly BatchItemStatus[];
  live: boolean;
  progress: number;
  taskTypes: readonly TaskType[];
}) => {
  const count = (status: BatchItemStatus) => items.filter((item) => item === status).length;
  const handled = count('done') + count('failed');
  return (
    <Panel p="6">
      <Flex align="baseline" justify="space-between">
        <Text fontSize="6xl" fontWeight="bold" lineHeight="1">
          {progress}%
        </Text>
        <Text color="fg.muted">
          {handled} of {items.length} items handled · {count('running')} running · {count('failed')}{' '}
          failed
        </Text>
      </Flex>
      <Progress.Root
        animated={live}
        colorPalette="blue"
        mb="5"
        mt="4"
        size="lg"
        striped={live}
        value={progress}
      >
        <Progress.Track borderRadius="full">
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
      <Grid gap="1.5" templateColumns="repeat(12, 1fr)">
        {items.map((item, index) => (
          // Items are identified by their position in the batch
          <Flex
            align="center"
            animation={item === 'running' ? 'pulse 1.2s ease-in-out infinite' : undefined}
            bg={CELL_STYLE[item].bg}
            borderColor={CELL_STYLE[item].border}
            borderRadius="md"
            borderWidth={item === 'running' ? '2px' : '1px'}
            color={CELL_STYLE[item].color}
            fontSize="xs"
            fontWeight="medium"
            h="9"
            justify="center"
            key={`item-${String(index + 1)}`}
            title={`Task ${index + 1} · ${TYPE_LABEL[taskTypes[index] ?? 'email']} · ${item}`}
          >
            {index + 1}
          </Flex>
        ))}
      </Grid>
      <HStack color="fg.muted" fontSize="xs" gap="5" mt="3.5">
        {LEGEND.map(([status, label]) => (
          <HStack gap="1.5" key={status}>
            <Box
              bg={CELL_STYLE[status].bg}
              borderColor={CELL_STYLE[status].border}
              borderRadius="sm"
              borderWidth="1px"
              boxSize="3"
            />
            <Text>{label}</Text>
          </HStack>
        ))}
      </HStack>
    </Panel>
  );
};
