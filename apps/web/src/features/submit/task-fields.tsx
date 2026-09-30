import { Button, Field, Grid, HStack, Input, Text, Textarea } from '@chakra-ui/react';

import { LabeledField, SelectField } from './form-controls';
import { randomEmailBody } from './random-email-body';

import type { TaskForm } from './submit-form';

export type TaskUpdate = (update: (task: TaskForm) => TaskForm) => void;

interface TaskFieldsProps {
  airportOptions: readonly (readonly [string, string])[];
  /** Omit to render the task read-only, e.g. a submitted job's payload */
  onChange?: TaskUpdate;
  task: TaskForm;
}

/** Payload fields for one email, webhook, or transit report task */
export const TaskFields = ({ airportOptions, onChange, task }: TaskFieldsProps) => {
  const readOnly = onChange === undefined;
  const setEmail = (change: Partial<TaskForm['email']>) => {
    onChange?.((current) => ({ ...current, email: { ...current.email, ...change } }));
  };
  const setWebhook = (change: Partial<TaskForm['webhook']>) => {
    onChange?.((current) => ({ ...current, webhook: { ...current.webhook, ...change } }));
  };
  const setTransit = (change: Partial<TaskForm['transit']>) => {
    onChange?.((current) => ({ ...current, transit: { ...current.transit, ...change } }));
  };

  if (task.type === 'email') {
    return (
      <>
        <Grid gap="3" templateColumns="1fr 1fr">
          <LabeledField label="To">
            <Input
              readOnly={readOnly}
              onChange={(event) => {
                setEmail({ to: event.currentTarget.value });
              }}
              type="email"
              value={task.email.to}
            />
          </LabeledField>
          <LabeledField label="Subject">
            <Input
              readOnly={readOnly}
              onChange={(event) => {
                setEmail({ subject: event.currentTarget.value });
              }}
              value={task.email.subject}
            />
          </LabeledField>
        </Grid>
        <Field.Root>
          <HStack justify="space-between" w="full">
            <Field.Label fontWeight="medium">Body</Field.Label>
            {!readOnly && (
              <Button
                colorPalette="blue"
                onClick={() => {
                  setEmail({ body: randomEmailBody(task.email.to) });
                }}
                size="xs"
                variant="ghost"
              >
                Generate random body
              </Button>
            )}
          </HStack>
          <Textarea
            autoresize={readOnly}
            readOnly={readOnly}
            onChange={(event) => {
              setEmail({ body: event.currentTarget.value });
            }}
            rows={5}
            value={task.email.body}
          />
        </Field.Root>
      </>
    );
  }

  if (task.type === 'webhook') {
    return (
      <>
        <Grid gap="3" templateColumns="1fr 140px">
          <LabeledField label="URL">
            <Input
              readOnly={readOnly}
              onChange={(event) => {
                setWebhook({ url: event.currentTarget.value });
              }}
              value={task.webhook.url}
            />
          </LabeledField>
          <SelectField
            readOnly={readOnly}
            label="Method"
            onChange={(value) => {
              setWebhook({ method: value === 'PUT' ? 'PUT' : 'POST' });
            }}
            options={[
              ['POST', 'POST'],
              ['PUT', 'PUT'],
            ]}
            value={task.webhook.method}
          />
        </Grid>
        <LabeledField label="Body (JSON)">
          <Textarea
            autoresize={readOnly}
            readOnly={readOnly}
            fontFamily="mono"
            fontSize="sm"
            onChange={(event) => {
              setWebhook({ body: event.currentTarget.value });
            }}
            rows={4}
            value={task.webhook.body}
          />
        </LabeledField>
        {!readOnly && (
          <Text color="fg.muted" fontSize="xs">
            20% of calls fail at random. A URL ending in /503 always fails, to demo retries.
          </Text>
        )}
      </>
    );
  }

  return (
    <Grid gap="3" templateColumns="1fr 1fr 1fr">
      <SelectField
        readOnly={readOnly}
        label="Origin"
        onChange={(origin) => {
          setTransit({ origin });
        }}
        options={airportOptions}
        value={task.transit.origin}
      />
      <SelectField
        readOnly={readOnly}
        label="Destination"
        onChange={(destination) => {
          setTransit({ destination });
        }}
        options={airportOptions}
        value={task.transit.destination}
      />
      <LabeledField label="Date">
        <Input
          readOnly={readOnly}
          onChange={(event) => {
            setTransit({ date: event.currentTarget.value });
          }}
          type="date"
          value={task.transit.date}
        />
      </LabeledField>
    </Grid>
  );
};
