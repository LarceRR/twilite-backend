import { randomInt } from 'node:crypto';

/**
 * Randomness is a dependency, not an ambient global: the spawn policy is a domain
 * rule and must be reproducible in tests.
 */
export interface RandomSource {
  /** Uniform integer in [0, exclusiveMax). */
  int(exclusiveMax: number): number;
}

export const RANDOM_SOURCE = Symbol('RANDOM_SOURCE');

export const cryptoRandomSource: RandomSource = {
  int: (exclusiveMax) => (exclusiveMax <= 1 ? 0 : randomInt(exclusiveMax)),
};

export function pickOne<T>(items: readonly T[], random: RandomSource): T | null {
  if (items.length === 0) {
    return null;
  }

  return items[random.int(items.length)] ?? null;
}
