import type { Email } from './email';

// Simulated data until the backend emails API exists. Deterministic so tests and reloads match.

const EMAIL_COUNT = 47;
const BASE_TIME = Date.UTC(2026, 8, 30, 12, 0, 0);
const MINUTES_BETWEEN_EMAILS = 97;

const names = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi', 'ivan'];
const domains = ['example.com', 'acme.io', 'mail.test'];
const topics = [
  'Quarterly report',
  'Team offsite',
  'Invoice',
  'Password reset',
  'Welcome aboard',
  'Weekly digest',
  'Meeting notes',
];

// Park-Miller LCG: tiny seeded PRNG so ids look random but stay stable across reloads
const LCG_MODULUS = 2_147_483_647;
const LCG_MULTIPLIER = 48_271;
// Spreads consecutive indexes apart; small seeds make the first draws near zero
const SEED_SPREAD = 104_729;

const seededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * LCG_MULTIPLIER) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
};

const hex = (random: () => number, length: number) =>
  Array.from({ length }, () => Math.floor(random() * 16).toString(16)).join('');

const uuid = (random: () => number) =>
  `${hex(random, 8)}-${hex(random, 4)}-4${hex(random, 3)}-a${hex(random, 3)}-${hex(random, 12)}`;

const pick = <T>(list: readonly T[], index: number): T => list[index % list.length]!;

const createEmail = (index: number): Email => {
  const random = seededRandom((index + 1) * SEED_SPREAD);
  const topic = pick(topics, index);
  return {
    body: `Hi ${pick(names, index)},\n\n${topic} #${index + 1}: lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\nBest regards`,
    id: uuid(random),
    recipient: `${pick(names, index)}@${pick(domains, index)}`,
    sentAt: new Date(BASE_TIME - index * MINUTES_BETWEEN_EMAILS * 60_000).toISOString(),
    subject: `${topic} #${index + 1}`,
  };
};

export const MOCK_EMAILS: readonly Email[] = Array.from({ length: EMAIL_COUNT }, (_, index) =>
  createEmail(index),
);
