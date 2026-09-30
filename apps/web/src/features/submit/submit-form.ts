import type { JobType, SubmitJobInput, TaskSpec, TaskType } from '@/features/jobs/job';

// Form state kept as strings (what inputs produce); `toSubmitInput` turns it into an API request.
// The form has two parts: the job itself (a single task, or a batch of tasks) and its settings.

export const MAX_BATCH_TASKS = 100;

export interface TaskForm {
  email: { body: string; subject: string; to: string };
  /** Stable identity for list rendering; not sent to the API */
  id: string;
  /** `departureAt` is a `datetime-local` value read as UTC, e.g. "2026-10-03T14:30" */
  transit: { departureAt: string; destination: string; origin: string };
  type: TaskType;
  webhook: { body: string; method: 'POST' | 'PUT'; url: string };
}

export type ScheduleMode = 'regular' | 'scheduled';

export interface SettingsForm {
  maxAttempts: string;
  priority: string;
  /** `datetime-local` input value in local time, e.g. "2026-10-01T14:30" */
  runAt: string;
  schedule: ScheduleMode;
}

export interface SubmitForm {
  batch: TaskForm[];
  settings: SettingsForm;
  /** The task used when `type` is not batch; keeps its values while switching types */
  task: TaskForm;
  type: JobType;
}

const DAY_MS = 86_400_000;

/** Tomorrow at 12:00 UTC, so the default departure is never in the past */
const defaultDeparture = (): string => {
  const tomorrow = new Date(Date.now() + DAY_MS);
  return `${tomorrow.toISOString().slice(0, 10)}T12:00`;
};

const DEPARTURE_FORM_LENGTH = 'YYYY-MM-DDTHH:mm'.length;

export const newTaskForm = (type: TaskType, id: string): TaskForm => ({
  email: {
    body: 'Hi,\n\nYour report is ready.',
    subject: 'Your report is ready',
    to: 'ana@example.com',
  },
  id,
  transit: { departureAt: defaultDeparture(), destination: 'LHR', origin: 'JFK' },
  type,
  webhook: {
    body: '{\n  "order_id": 1042\n}',
    method: 'POST',
    url: 'https://hooks.example.com/orders',
  },
});

/** Form values for a stored task, used to show a job's payload as a read-only form */
export const taskFormFromSpec = (spec: TaskSpec, id: string): TaskForm => {
  const form = newTaskForm(spec.type, id);
  if (spec.type === 'email') return { ...form, email: spec.payload };
  if (spec.type === 'webhook') {
    return {
      ...form,
      webhook: { ...spec.payload, body: JSON.stringify(spec.payload.body, null, 2) },
    };
  }
  return {
    ...form,
    transit: {
      ...spec.payload,
      departureAt: spec.payload.departureAt.slice(0, DEPARTURE_FORM_LENGTH),
    },
  };
};

export const initialSubmitForm = (type: JobType, newId: () => string): SubmitForm => ({
  batch: [newTaskForm('email', newId()), newTaskForm('webhook', newId())],
  settings: { maxAttempts: '3', priority: '5', runAt: '', schedule: 'regular' },
  task: newTaskForm(type === 'batch' ? 'transit' : type, newId()),
  type,
});

const pad = (value: number) => String(value).padStart(2, '0');

/** Formats a timestamp as a `datetime-local` value in the browser's time zone */
export const toLocalInputValue = (ms: number): string => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** `datetime-local` value for a quick "in N minutes" link */
export const inMinutes = (now: number, minutes: number): string =>
  toLocalInputValue(now + minutes * 60_000);

export type SubmitFormResult = { error: string; ok: false } | { input: SubmitJobInput; ok: true };
type TaskResult = { error: string; ok: false } | { ok: true; task: TaskSpec };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const toInteger = (value: string, min: number, max: number): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseObject = (json: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(json);
    return isPlainObject(value) ? value : null;
  } catch {
    return null;
  }
};

const fail = (error: string) => ({ error, ok: false }) as const;

export const toTaskSpec = (task: TaskForm): TaskResult => {
  if (task.type === 'email') {
    const { body, subject, to } = task.email;
    if (!EMAIL_PATTERN.test(to)) return fail('Recipient must be an email address');
    if (subject.trim() === '') return fail('Subject is required');
    return { ok: true, task: { payload: { body, subject: subject.trim(), to }, type: 'email' } };
  }
  if (task.type === 'webhook') {
    const { body: json, method, url } = task.webhook;
    if (!URL.canParse(url)) return fail('Webhook URL must be a valid URL');
    const body = parseObject(json);
    if (body === null) return fail('Webhook body must be a JSON object');
    return { ok: true, task: { payload: { body, method, url }, type: 'webhook' } };
  }
  const { departureAt, destination, origin } = task.transit;
  if (origin === destination) return fail('Origin and destination must differ');
  const departure = Date.parse(`${departureAt}:00Z`);
  if (Number.isNaN(departure)) return fail('Departure date and time are required');
  return {
    ok: true,
    task: {
      payload: { departureAt: new Date(departure).toISOString(), destination, origin },
      type: 'transit',
    },
  };
};

const toSpec = (
  form: SubmitForm,
): { error: string; ok: false } | { ok: true; spec: SubmitJobInput } => {
  if (form.type !== 'batch') {
    const result = toTaskSpec(form.task);
    return result.ok ? { ok: true, spec: result.task } : result;
  }
  if (form.batch.length === 0) return fail('Add at least one task');
  if (form.batch.length > MAX_BATCH_TASKS)
    return fail(`A batch holds at most ${MAX_BATCH_TASKS} tasks`);
  const items: TaskSpec[] = [];
  for (const [index, task] of form.batch.entries()) {
    const result = toTaskSpec(task);
    if (!result.ok) return fail(`Task ${index + 1}: ${result.error}`);
    items.push(result.task);
  }
  return { ok: true, spec: { payload: { items }, type: 'batch' } };
};

export const toSubmitInput = (
  form: SubmitForm,
  now: number,
  idempotencyKey: string,
): SubmitFormResult => {
  const { settings } = form;
  const priority = toInteger(settings.priority, 1, 5);
  if (priority === null) return fail('Priority must be a whole number from 1 to 5');
  const maxAttempts = toInteger(settings.maxAttempts, 1, 10);
  if (maxAttempts === null) return fail('Max attempts must be a whole number from 1 to 10');
  let runAt: string | undefined;
  if (settings.schedule === 'scheduled') {
    const at = Date.parse(settings.runAt);
    if (Number.isNaN(at)) return fail('Pick a date and time for the scheduled run');
    if (at <= now) return fail('Scheduled time must be in the future');
    runAt = new Date(at).toISOString();
  }
  const job = toSpec(form);
  if (!job.ok) return job;
  return {
    input: {
      ...job.spec,
      idempotencyKey,
      maxAttempts,
      priority,
      ...(runAt === undefined ? {} : { runAt }),
    },
    ok: true,
  };
};
