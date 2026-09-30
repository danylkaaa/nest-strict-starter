import { Text } from '@chakra-ui/react';

import { KeyValueList } from '@/shared/ui/key-value-list';
import { Panel } from '@/shared/ui/panel';

import type { Job } from '@/features/jobs/job';

/** Result as labeled fields; transit reports have their own map view instead */
export const ResultView = ({ job }: { job: Job }) => {
  if (job.type === 'transit') return null;
  if (job.type === 'batch') {
    return (
      <Panel title="Summary on completion">
        {job.result === null ? (
          <Text color="fg.muted">Available when the batch finishes.</Text>
        ) : (
          <KeyValueList
            items={[
              { label: 'Processed', value: job.result.processed },
              { label: 'Succeeded', value: job.result.succeeded },
              { label: 'Failed', value: job.result.failed },
              { label: 'Duration', value: `${(job.result.durationMs / 1000).toFixed(1)} s` },
            ]}
          />
        )}
      </Panel>
    );
  }
  if (job.result === null) return null;
  return (
    <Panel title="Result">
      <KeyValueList
        items={
          job.type === 'email'
            ? [{ label: 'Message ID', mono: true, value: job.result.messageId }]
            : [{ label: 'Status code', mono: true, value: job.result.statusCode }]
        }
      />
    </Panel>
  );
};
