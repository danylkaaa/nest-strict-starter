const OPENERS = [
  'Thanks for your order. It is being prepared and will ship soon.',
  'Your monthly report is ready to download from the dashboard.',
  'We noticed a new sign-in to your account from a new device.',
  'Your invoice for this billing period is attached.',
  'Welcome aboard! Your account is set up and ready to use.',
  'The meeting has moved to Thursday at 10:00.',
];

const MIDDLES = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
];

const CLOSINGS = [
  'If you have questions, just reply to this email.',
  'No action is needed on your side.',
  'Let us know if anything looks wrong.',
];

const SIGN_OFFS = ['Best regards', 'Thanks', 'Cheers', 'Kind regards'];
const SENDERS = ['Jobqueue', 'The Jobqueue team', 'Support'];

const pick = (random: () => number, list: readonly string[]) =>
  list[Math.floor(random() * list.length)]!;

/** Plausible email body for demo submissions; `random` is injected so tests are deterministic */
export const randomEmailBody = (recipient: string, random: () => number = Math.random): string => {
  const localPart = recipient.split('@')[0]?.trim() ?? '';
  const name = localPart === '' ? 'there' : localPart;
  return [
    `Hi ${name},`,
    `${pick(random, OPENERS)} ${pick(random, MIDDLES)}`,
    pick(random, CLOSINGS),
    `${pick(random, SIGN_OFFS)},\n${pick(random, SENDERS)}`,
  ].join('\n\n');
};
