import { Button, Field, HStack, Input, SegmentGroup, Text } from '@chakra-ui/react';

import { inMinutes } from './submit-form';

import type { SettingsForm } from './submit-form';

const QUICK_PICKS = [
  { label: '+5m', minutes: 5 },
  { label: '+15m', minutes: 15 },
  { label: '+1h', minutes: 60 },
] as const;

const DEFAULT_DELAY_MINUTES = 15;

const MODES = [
  { label: 'Regular', value: 'regular' },
  { label: 'Scheduled', value: 'scheduled' },
];

interface ScheduleFieldsProps {
  onChange: (change: Partial<SettingsForm>) => void;
  settings: SettingsForm;
}

/** Regular (run now) or scheduled (run at a picked local date and time) */
export const ScheduleFields = ({ onChange, settings }: ScheduleFieldsProps) => (
  <Field.Root>
    <Field.Label fontWeight="medium">Execution</Field.Label>
    <SegmentGroup.Root
      onValueChange={({ value }) => {
        if (value === 'regular') onChange({ schedule: 'regular' });
        if (value === 'scheduled') {
          onChange({
            // Preselect a sensible time the first time scheduling is turned on
            runAt:
              settings.runAt === '' ? inMinutes(Date.now(), DEFAULT_DELAY_MINUTES) : settings.runAt,
            schedule: 'scheduled',
          });
        }
      }}
      value={settings.schedule}
    >
      <SegmentGroup.Indicator />
      <SegmentGroup.Items items={MODES} />
    </SegmentGroup.Root>
    {settings.schedule === 'regular' ? (
      <Field.HelperText>Runs as soon as a worker is free.</Field.HelperText>
    ) : (
      <>
        <HStack gap="3" mt="2">
          <Input
            aria-label="Run at"
            onChange={(event) => {
              onChange({ runAt: event.currentTarget.value });
            }}
            type="datetime-local"
            value={settings.runAt}
            w="240px"
          />
          <Text color="fg.muted" fontSize="sm">
            Quick pick:
          </Text>
          {QUICK_PICKS.map(({ label, minutes }) => (
            <Button
              colorPalette="blue"
              key={label}
              onClick={() => {
                onChange({ runAt: inMinutes(Date.now(), minutes) });
              }}
              px="1"
              size="sm"
              variant="plain"
            >
              {label}
            </Button>
          ))}
        </HStack>
        <Field.HelperText>Local time. The job shows as scheduled until then.</Field.HelperText>
      </>
    )}
  </Field.Root>
);
