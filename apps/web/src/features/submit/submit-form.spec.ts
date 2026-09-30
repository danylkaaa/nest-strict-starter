import { describe, expect, it } from 'vitest';

import {
  inMinutes,
  initialSubmitForm,
  newTaskForm,
  taskFormFromSpec,
  toLocalInputValue,
  toSubmitInput,
  toTaskSpec,
  type SubmitForm,
} from './submit-form';

const now = Date.UTC(2026, 9, 1, 12);
const key = 'web-b3a1c2d4-0000-4000-8000-000000000001';

let ids = 0;
const newId = () => {
  ids += 1;
  return `task-${ids}`;
};
const form = (type: SubmitForm['type']) => initialSubmitForm(type, newId);

describe('toSubmitInput', () => {
  it('builds a regular email job with the generated key', () => {
    expect(toSubmitInput(form('email'), now, key)).toEqual({
      input: {
        idempotencyKey: key,
        maxAttempts: 3,
        payload: {
          body: 'Hi,\n\nYour report is ready.',
          subject: 'Your report is ready',
          to: 'ana@example.com',
        },
        priority: 5,
        type: 'email',
      },
      ok: true,
    });
  });

  it('parses the webhook body as JSON', () => {
    expect(toSubmitInput(form('webhook'), now, key)).toMatchObject({
      input: { payload: { body: { order_id: 1042 }, method: 'POST' } },
      ok: true,
    });
  });

  it('builds a batch from tasks of different types', () => {
    const batch = {
      ...form('batch'),
      batch: [newTaskForm('email', 'a'), newTaskForm('transit', 'b')],
    };

    expect(toSubmitInput(batch, now, key)).toMatchObject({
      input: {
        payload: {
          items: [
            { payload: { to: 'ana@example.com' }, type: 'email' },
            { payload: { destination: 'LHR', origin: 'JFK' }, type: 'transit' },
          ],
        },
        type: 'batch',
      },
      ok: true,
    });
  });

  it('names the batch task that is invalid', () => {
    const broken = newTaskForm('webhook', 'b');
    broken.webhook.url = 'not a url';
    const batch = { ...form('batch'), batch: [newTaskForm('email', 'a'), broken] };

    expect(toSubmitInput(batch, now, key)).toEqual({
      error: 'Task 2: Webhook URL must be a valid URL',
      ok: false,
    });
  });

  it('rejects an empty batch', () => {
    expect(toSubmitInput({ ...form('batch'), batch: [] }, now, key)).toEqual({
      error: 'Add at least one task',
      ok: false,
    });
  });

  it('sends runAt for a scheduled job', () => {
    const scheduled = form('email');
    scheduled.settings = {
      ...scheduled.settings,
      runAt: inMinutes(now, 15),
      schedule: 'scheduled',
    };

    expect(toSubmitInput(scheduled, now, key)).toMatchObject({
      input: { runAt: '2026-10-01T12:15:00.000Z' },
      ok: true,
    });
  });

  it('ignores the picked time for a regular job', () => {
    const regular = form('email');
    regular.settings = { ...regular.settings, runAt: inMinutes(now, 15) };

    expect(toSubmitInput(regular, now, key)).not.toHaveProperty('input.runAt');
  });

  it.each([
    [{ runAt: '', schedule: 'scheduled' as const }, 'Pick a date and time for the scheduled run'],
    [
      { runAt: inMinutes(now, -5), schedule: 'scheduled' as const },
      'Scheduled time must be in the future',
    ],
    [{ priority: '6' }, 'Priority must be a whole number from 1 to 5'],
    [{ priority: '0' }, 'Priority must be a whole number from 1 to 5'],
    [{ maxAttempts: '0' }, 'Max attempts must be a whole number from 1 to 10'],
  ])('rejects settings %o', (change, error) => {
    const invalid = form('email');
    invalid.settings = { ...invalid.settings, ...change };

    expect(toSubmitInput(invalid, now, key)).toEqual({ error, ok: false });
  });

  it.each([
    [
      'email',
      (task: SubmitForm['task']) => {
        task.email.to = 'bad';
      },
      'Recipient must be an email address',
    ],
    [
      'webhook',
      (task: SubmitForm['task']) => {
        task.webhook.body = '[1]';
      },
      'Webhook body must be a JSON object',
    ],
    [
      'transit',
      (task: SubmitForm['task']) => {
        task.transit.destination = 'JFK';
      },
      'Origin and destination must differ',
    ],
  ] as const)('rejects an invalid %s task', (type, breakTask, error) => {
    const invalid = form(type);
    breakTask(invalid.task);

    expect(toSubmitInput(invalid, now, key)).toEqual({ error, ok: false });
  });
});

describe('toLocalInputValue', () => {
  it('round-trips through the datetime-local format to the minute', () => {
    const at = Date.UTC(2026, 9, 1, 12, 34);

    expect(Date.parse(toLocalInputValue(at))).toBe(at);
    expect(toLocalInputValue(at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u);
  });
});

describe('taskFormFromSpec', () => {
  it.each([
    { payload: { body: 'Hello', subject: 'Invoice #1', to: 'kim@contoso.net' }, type: 'email' },
    {
      payload: { body: { orderId: 7 }, method: 'PUT', url: 'https://api.acme.io/events' },
      type: 'webhook',
    },
    {
      payload: { departureAt: '2026-10-09T14:30:00.000Z', destination: 'SIN', origin: 'KBP' },
      type: 'transit',
    },
  ] as const)('round-trips a $type task through the form', (spec) => {
    expect(toTaskSpec(taskFormFromSpec(spec, 'id'))).toEqual({ ok: true, task: spec });
  });
});
