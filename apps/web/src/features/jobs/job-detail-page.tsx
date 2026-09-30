import { Alert, Button, Center, Grid, Link, Spinner, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, useParams } from 'react-router';

import { ApiError } from '@/shared/api-error';
import { formatDate, formatTime } from '@/shared/format';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { KeyValueList } from '@/shared/ui/key-value-list';
import { PageHeader } from '@/shared/ui/page-header';
import { Panel } from '@/shared/ui/panel';

import { AttemptsPanel } from './components/attempts-panel';
import { BatchProgress, BatchTaskGraph } from './components/batch-progress';
import { LogList } from './components/log-list';
import { PayloadView } from './components/payload-view';
import { ResultView } from './components/result-view';
import { StatusBadge } from './components/status-badge';
import { canCancel, canRetry, displayStatus, TYPE_LABEL } from './job-rules';
import { useBatch, useJob } from './queries';
import { TransitReportView } from './transit/transit-report-view';
import { useJobActions } from './use-job-actions';

import type { Job } from './job';
import type { Crumb } from '@/shared/ui/breadcrumbs';

const orNone = (iso: string | null) => (iso === null ? 'none' : formatTime(iso));

const subtitle = (job: Job) =>
  job.type === 'batch'
    ? `Batch · ${job.payload.items.length} tasks · priority ${job.priority}`
    : job.status === 'processing'
      ? `${TYPE_LABEL[job.type]} job · ${job.workerId ?? 'worker'} · started ${orNone(job.startedAt)}`
      : `${TYPE_LABEL[job.type]} job · ${job.attempts} of ${job.maxAttempts} attempts used`;

export const JobDetail = ({ job }: { job: Job }) => {
  const isBatch = job.type === 'batch';
  const { busy, cancel, retry } = useJobActions();
  const report = job.type === 'transit' ? job.result : null;

  const crumbs: Crumb[] = [
    { label: 'Home', to: '/' },
    { label: 'Jobs', to: '/jobs' },
    report === null
      ? { label: job.id, mono: true }
      : { label: job.id, mono: true, to: `/jobs/${job.id}` },
    ...(report === null ? [] : [{ label: 'Transit report' }]),
  ];

  return (
    <>
      <Breadcrumbs items={crumbs} />
      <PageHeader
        actions={
          report === null ? (
            <>
              {canCancel(job) && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    cancel(job);
                  }}
                  variant="outline"
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
                >
                  Retry job
                </Button>
              )}
            </>
          ) : undefined
        }
        badge={<StatusBadge status={displayStatus(job)} />}
        mono={report === null}
        subtitle={
          report === null
            ? subtitle(job)
            : `Aircraft transit report · ${job.id} · ${job.attempts} attempt${job.attempts === 1 ? '' : 's'}`
        }
        title={
          report === null
            ? job.id
            : `${report.origin.code} → ${report.destination.code} · ${formatDate(report.departureAt)}`
        }
      />
      {job.status === 'failed' && job.error !== null && (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Title>Failed</Alert.Title>
          <Alert.Description>
            {job.error} (last attempt {orNone(job.attemptHistory.at(-1)?.finishedAt ?? null)})
          </Alert.Description>
        </Alert.Root>
      )}
      {job.type === 'batch' && job.batchStatus === 'cancelling' && (
        <Alert.Root status="warning">
          <Alert.Indicator />
          <Alert.Title>Cancelling</Alert.Title>
          <Alert.Description>
            Waiting for running tasks to finish. They will not be retried.
          </Alert.Description>
        </Alert.Root>
      )}
      {report !== null && <TransitReportView report={report} />}
      {job.type === 'batch' && (
        <BatchProgress
          items={job.batchItems}
          live={job.status === 'processing'}
          progress={job.progress}
        />
      )}
      <Grid alignItems="start" gap="5" templateColumns="minmax(0, 1fr) minmax(0, 1.4fr)">
        <Stack gap="5">
          <Panel title="Details">
            <KeyValueList
              items={[
                { label: 'ID', mono: true, value: job.id },
                { label: 'Status', value: <StatusBadge status={displayStatus(job)} /> },
                { label: 'Type', mono: true, value: job.type },
                { label: 'Priority', mono: true, value: job.priority },
                isBatch
                  ? { label: 'Max attempts per task', mono: true, value: job.maxAttempts }
                  : {
                      label: 'Attempts',
                      mono: true,
                      value: `${job.attempts} / ${job.maxAttempts}`,
                    },
                ...(job.batchId === null
                  ? []
                  : [
                      {
                        label: 'Batch',
                        value: (
                          <Link asChild color="blue.600" fontFamily="mono" fontSize="xs">
                            <RouterLink to={`/batches/${job.batchId}`}>{job.batchId}</RouterLink>
                          </Link>
                        ),
                      },
                    ]),
                { label: 'Created', mono: true, value: formatTime(job.createdAt) },
                { label: 'Started', mono: true, value: orNone(job.startedAt) },
                { label: 'Completed', mono: true, value: orNone(job.completedAt) },
                { label: 'Scheduled for', mono: true, value: orNone(job.runAt) },
                { label: 'Idempotency key', mono: true, value: job.idempotencyKey ?? 'none' },
              ]}
            />
          </Panel>
          <ResultView job={job} />
        </Stack>
        {job.type === 'batch' ? (
          <BatchTaskGraph
            items={job.batchItems}
            taskTypes={job.payload.items.map((task) => task.type)}
          />
        ) : (
          <Stack gap="5">
            <AttemptsPanel attempts={job.attemptHistory} />
            <Panel title="Logs">
              <LogList logs={job.logs} />
            </Panel>
          </Stack>
        )}
      </Grid>
      <Panel
        extra="read-only"
        title={job.type === 'batch' ? `Tasks (${job.payload.items.length})` : 'Payload'}
      >
        <PayloadView job={job} />
      </Panel>
    </>
  );
};

const NotFound = ({ id, label }: { id: string; label: string }) => (
  <>
    <Breadcrumbs
      items={[{ label: 'Home', to: '/' }, { label: 'Jobs', to: '/jobs' }, { label: id }]}
    />
    <Text color="fg.muted">
      {label} {id} does not exist.
    </Text>
  </>
);

export const BatchDetailPage = () => {
  const { id = '' } = useParams();
  const { data, error } = useBatch(id);

  if (error instanceof ApiError && error.code === 'JobBatchNotFoundError')
    return <NotFound id={id} label="Batch" />;
  if (data === undefined) {
    return (
      <Center py="16">
        <Spinner />
      </Center>
    );
  }
  return <JobDetail job={data} />;
};

export const JobDetailPage = () => {
  const { id = '' } = useParams();
  const { data, error } = useJob(id);

  if (error instanceof ApiError && error.code === 'NOT_FOUND') {
    return (
      <>
        <Breadcrumbs
          items={[{ label: 'Home', to: '/' }, { label: 'Jobs', to: '/jobs' }, { label: id }]}
        />
        <Text color="fg.muted">Job {id} does not exist.</Text>
      </>
    );
  }
  if (data === undefined) {
    return (
      <Center py="16">
        <Spinner />
      </Center>
    );
  }
  return <JobDetail job={data} />;
};
