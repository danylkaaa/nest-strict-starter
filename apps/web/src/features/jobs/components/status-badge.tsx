import { Badge } from '@chakra-ui/react';

import { STATUS_PALETTE } from '@/features/jobs/job-rules';

import type { JobStatus } from '@/features/jobs/job';

export const StatusBadge = ({ status }: { status: JobStatus }) => (
  <Badge
    animation={status === 'processing' ? 'pulse 1.4s ease-in-out infinite' : undefined}
    colorPalette={STATUS_PALETTE[status]}
    fontWeight="bold"
    opacity={status === 'cancelled' ? 0.7 : 1}
    size="sm"
    textTransform="uppercase"
    variant="subtle"
  >
    {status}
  </Badge>
);
