import { Box, Button, Grid, Input, SegmentGroup, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { JOB_TYPES } from '@/features/jobs/job';
import { useAirports, useSubmitJob } from '@/features/jobs/queries';
import { ApiError } from '@/shared/api-error';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { PageHeader } from '@/shared/ui/page-header';
import { Panel } from '@/shared/ui/panel';
import { toaster } from '@/shared/ui/toaster';

import { BatchTasks } from './batch-tasks';
import { LabeledField } from './form-controls';
import { newIdempotencyKey } from './idempotency-key';
import { ScheduleFields } from './schedule-fields';
import { initialSubmitForm, toSubmitInput } from './submit-form';
import { TaskFields } from './task-fields';
import { TASK_TYPE_LABEL, toTaskType } from './task-types';

import type { SettingsForm, SubmitForm } from './submit-form';
import type { JobType } from '@/features/jobs/job';

const JOB_TYPE_TABS = [
  { label: TASK_TYPE_LABEL.email, value: 'email' },
  { label: TASK_TYPE_LABEL.webhook, value: 'webhook' },
  { label: TASK_TYPE_LABEL.transit, value: 'transit' },
  { label: 'Batch', value: 'batch' },
];

const toJobType = (value: string | null): JobType | undefined =>
  JOB_TYPES.find((type) => type === value);

const newId = () => crypto.randomUUID();

export const SubmitJobPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<SubmitForm>(() =>
    initialSubmitForm(toJobType(params.get('type')) ?? 'transit', newId),
  );
  // Regenerated whenever the form changes or a submit succeeds; see idempotency-key.ts
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const airports = useAirports();
  const submit = useSubmitJob();
  const airportOptions = (airports.data ?? []).map(
    (airport) => [airport.code, `${airport.code} · ${airport.city}`] as const,
  );

  const update = (change: (current: SubmitForm) => SubmitForm) => {
    setForm(change);
    setIdempotencyKey(newIdempotencyKey());
  };
  const updateSettings = (change: Partial<SettingsForm>) => {
    update((current) => ({ ...current, settings: { ...current.settings, ...change } }));
  };

  const onSubmit = () => {
    const result = toSubmitInput(form, Date.now(), idempotencyKey);
    if (!result.ok) {
      toaster.error({ description: result.error, title: 'Check the form' });
      return;
    }
    submit.mutate(result.input, {
      onError: (error) => {
        toaster.error({
          description: error instanceof ApiError ? error.message : 'Unexpected error',
          title: 'Job was not submitted',
        });
      },
      onSuccess: ({ created, job }) => {
        setIdempotencyKey(newIdempotencyKey());
        if (created) toaster.success({ title: `Created ${job.id}` });
        else {
          toaster.info({
            description: 'Duplicate submit detected',
            title: `Returned existing ${job.id}`,
          });
        }
        void navigate(`/jobs/${job.id}`);
      },
    });
  };

  return (
    <>
      <Breadcrumbs
        items={[{ label: 'Home', to: '/' }, { label: 'Jobs', to: '/jobs' }, { label: 'New job' }]}
      />
      <PageHeader title="New job" />
      <Stack
        as="form"
        gap="5"
        maxW="720px"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Panel extra="What to run" p="6" title="Job">
          <Stack gap="4">
            <Box>
              <Text fontWeight="medium" mb="1.5">
                Job type
              </Text>
              <SegmentGroup.Root
                onValueChange={({ value }) => {
                  const type = toJobType(value);
                  if (type === undefined) return;
                  const taskType = toTaskType(type);
                  update((current) => ({
                    ...current,
                    task:
                      taskType === undefined ? current.task : { ...current.task, type: taskType },
                    type,
                  }));
                }}
                value={form.type}
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Items items={JOB_TYPE_TABS} />
              </SegmentGroup.Root>
            </Box>
            {form.type === 'batch' ? (
              <BatchTasks
                airportOptions={airportOptions}
                newId={newId}
                onChange={(change) => {
                  update((current) => ({ ...current, batch: change(current.batch) }));
                }}
                tasks={form.batch}
              />
            ) : (
              <TaskFields
                airportOptions={airportOptions}
                onChange={(change) => {
                  update((current) => ({ ...current, task: change(current.task) }));
                }}
                task={form.task}
              />
            )}
          </Stack>
        </Panel>

        <Panel extra="How and when to run it" p="6" title="Settings">
          <Stack gap="4">
            <Grid gap="3" templateColumns="1fr 1fr">
              <LabeledField label="Priority (higher first)">
                <Input
                  max={10}
                  min={0}
                  onChange={(event) => {
                    updateSettings({ priority: event.currentTarget.value });
                  }}
                  type="number"
                  value={form.settings.priority}
                />
              </LabeledField>
              <LabeledField label="Max attempts">
                <Input
                  max={10}
                  min={1}
                  onChange={(event) => {
                    updateSettings({ maxAttempts: event.currentTarget.value });
                  }}
                  type="number"
                  value={form.settings.maxAttempts}
                />
              </LabeledField>
            </Grid>
            <ScheduleFields onChange={updateSettings} settings={form.settings} />
          </Stack>
        </Panel>

        <Button
          alignSelf="flex-start"
          colorPalette="blue"
          loading={submit.isPending}
          px="5"
          type="submit"
        >
          {form.settings.schedule === 'scheduled' ? 'Schedule job' : 'Submit job'}
        </Button>
      </Stack>
    </>
  );
};
