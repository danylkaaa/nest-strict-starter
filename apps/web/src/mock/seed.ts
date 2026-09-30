import { AIRPORTS } from './airports';
import { createMockServer } from './mock-server';
import { between, pick, seededRandom } from './random';

import type { MockServer } from './mock-server';
import type { Random } from './random';
import type { SubmitJobInput, TaskSpec } from '@/features/jobs/job';

// Replays ~45 minutes of queue traffic on a virtual clock so the UI opens with realistic history,
// then hands the server over to the real clock.

const SEED = 42;
const WORKERS = 3;
const HISTORY_SECONDS = 45 * 60;
const SUBMIT_CHANCE_PER_SECOND = 1 / 18;

const RECIPIENTS = [
  'ana@example.com',
  'lee@example.com',
  'sam@acme.io',
  'priya@northwind.co',
  'marco@example.org',
  'jo@fabrikam.dev',
  'dana@example.com',
  'kim@contoso.net',
  'ghost@bounce.test',
];
const SUBJECTS = [
  'Welcome aboard',
  'Invoice #',
  'Your report is ready',
  'Password reset',
  'Order confirmation #',
  'Weekly digest',
  'Shipping update #',
];
const HOOKS = [
  'https://hooks.example.com/orders',
  'https://api.acme.io/events',
  'https://partner.northwind.co/sync',
  'https://httpstat.us/503',
];

let orderNumber = 1040;

// Job mix: 50% email, 25% webhook, 15% transit report, 10% batch
const BATCH_SHARE = 0.1;
const EMAIL_SHARE_OF_TASKS = 0.5 / 0.9;
const WEBHOOK_SHARE_OF_TASKS = 0.75 / 0.9;

const randomTask = (random: Random, roll = random()): TaskSpec => {
  if (roll < EMAIL_SHARE_OF_TASKS) {
    const subject = pick(random, SUBJECTS);
    const to = pick(random, RECIPIENTS);
    return {
      payload: {
        body: `Hi ${to.split('@')[0]},\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\nBest regards,\nJobqueue`,
        subject: subject.endsWith('#') ? `${subject}${orderNumber}` : subject,
        to,
      },
      type: 'email',
    };
  }
  if (roll < WEBHOOK_SHARE_OF_TASKS) {
    return {
      payload: { body: { orderId: orderNumber }, method: 'POST', url: pick(random, HOOKS) },
      type: 'webhook',
    };
  }
  const origin = pick(random, AIRPORTS);
  const destination = pick(
    random,
    AIRPORTS.filter((airport) => airport.code !== origin.code),
  );
  return {
    payload: {
      date: `2026-10-${String(between(random, 1, 28)).padStart(2, '0')}`,
      destination: destination.code,
      origin: origin.code,
    },
    type: 'transit',
  };
};

const randomBatch = (random: Random, size: number): SubmitJobInput => ({
  payload: { items: Array.from({ length: size }, () => randomTask(random)) },
  type: 'batch',
});

const randomJob = (random: Random): SubmitJobInput => {
  orderNumber += 1;
  const roll = random();
  return roll < 1 - BATCH_SHARE
    ? randomTask(random, roll / (1 - BATCH_SHARE))
    : randomBatch(random, between(random, 8, 24));
};

const withOptions = (random: Random, input: SubmitJobInput): SubmitJobInput => ({
  ...input,
  ...(random() < 0.3 ? { idempotencyKey: `order-${orderNumber}-${input.type}` } : {}),
  priority: between(random, 0, 9),
});

export const createSeededMockServer = (realNow: () => number): MockServer => {
  const random = seededRandom(SEED);
  const start = realNow();
  let virtualNow: number | null = start - HISTORY_SECONDS * 1000;
  const server = createMockServer({ now: () => virtualNow ?? realNow(), random, workers: WORKERS });
  const minutesFromNow = (minutes: number) => new Date(start + minutes * 60_000).toISOString();

  for (let second = 0; second < HISTORY_SECONDS; second += 1) {
    if (random() < SUBMIT_CHANCE_PER_SECOND) {
      const { job } = server.submitJob(withOptions(random, randomJob(random)));
      if (random() < 0.05) server.cancelJob(job.id);
    }
    if (second === HISTORY_SECONDS - 6) {
      server.submitJob({ ...randomBatch(random, 24), priority: 5 });
    }
    virtualNow += 1000;
    server.tick();
  }

  // Leave a visible queue behind: pending jobs waiting for workers and a few scheduled ones
  for (let index = 0; index < 4; index += 1)
    server.submitJob(withOptions(random, randomJob(random)));
  server.submitJob({
    payload: { date: '2026-10-03', destination: 'LHR', origin: 'JFK' },
    priority: 3,
    runAt: minutesFromNow(10),
    type: 'transit',
  });
  server.submitJob({ ...randomJob(random), priority: 2, runAt: minutesFromNow(25) });

  virtualNow = null;
  return server;
};
