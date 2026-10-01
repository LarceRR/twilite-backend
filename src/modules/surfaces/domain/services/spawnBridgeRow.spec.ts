import { describe, expect, it } from 'vitest';

import type { RandomSource } from '@/shared/utils/random';

import { BRIDGE_CENTER_COLUMN, spawnBridgeRow } from './spawnBridgeRow';

const firstChoice: RandomSource = { int: () => 0 };

describe('spawnBridgeRow', () => {
  it('places the first object on the center of the front row', () => {
    expect(spawnBridgeRow({ occupied: [], random: firstChoice })).toEqual({
      x: BRIDGE_CENTER_COLUMN,
      y: 0,
    });
  });

  it('advances row and avoids repeating the previous column', () => {
    const first = spawnBridgeRow({ occupied: [], random: firstChoice });
    const second = spawnBridgeRow({
      occupied: [first],
      lastCreated: first,
      random: firstChoice,
    });
    expect(second.y).toBe(1);
    expect(second.x).not.toBe(first.x);
    expect(second.x).toBeGreaterThanOrEqual(0);
    expect(second.x).toBeLessThan(5);
  });
});
