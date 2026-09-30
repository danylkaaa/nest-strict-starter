// Park-Miller LCG: seeded so the mock data looks random but is the same on every reload
const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;

export type Random = () => number;

export const seededRandom = (seed: number): Random => {
  let state = seed % MODULUS || 1;
  return () => {
    state = (state * MULTIPLIER) % MODULUS;
    return state / MODULUS;
  };
};

export const pick = <T>(random: Random, list: readonly T[]): T =>
  list[Math.floor(random() * list.length)]!;

export const between = (random: Random, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

export const randomId = (random: Random, prefix: string, length: number): string =>
  prefix + Array.from({ length }, () => Math.floor(random() * 36).toString(36)).join('');
