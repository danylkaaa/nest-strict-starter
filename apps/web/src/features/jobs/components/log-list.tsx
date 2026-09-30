import { Box, HStack, Stack, Text } from '@chakra-ui/react';

import { formatTime } from '@/shared/format';

import type { JobLog, LogLevel } from '@/features/jobs/job';

const LEVEL_COLOR: Record<LogLevel, string> = {
  error: 'red.500',
  info: 'blue.600',
  warning: 'orange.500',
};

export const LogList = ({ logs }: { logs: readonly JobLog[] }) => (
  <Stack fontFamily="mono" fontSize="xs" gap="1.5">
    {logs.map((entry, index) => (
      // Logs are append-only, so the position is a stable identity
      <HStack align="flex-start" gap="3.5" key={`${entry.at}-${String(index)}`}>
        <Text color="fg.subtle" flex="none">
          {formatTime(entry.at)}
        </Text>
        <Box color={LEVEL_COLOR[entry.level]} flex="none" fontWeight="bold" w="16">
          {entry.level}
        </Box>
        <Text>{entry.message}</Text>
      </HStack>
    ))}
  </Stack>
);
