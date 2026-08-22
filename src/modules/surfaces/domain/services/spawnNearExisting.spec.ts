import { describe, expect, it } from 'vitest';

import { type Cell, cellDistance } from '@/modules/surface-objects/domain/value-objects/Cell';
import type { RandomSource } from '@/shared/utils/random';

import { spawnNearExisting } from './spawnNearExisting';

const firstChoice: RandomSource = { int: () => 0 };

describe('spawnNearExisting', () => {
  it('places the first object at the origin', () => {
    expect(spawnNearExisting({ occupied: [], radius: 2, random: firstChoice })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('places a new object within the radius of an occupied cell', () => {
    const occupied: Cell[] = [{ x: 0, y: 0 }];

    const cell = spawnNearExisting({ occupied, radius: 2, random: firstChoice });

    expect(cellDistance(cell, { x: 0, y: 0 })).toBeLessThanOrEqual(2);
  });

  it('respects minSeparation of 2 (no 8-neighbour contact)', () => {
    const occupied: Cell[] = [{ x: 0, y: 0 }];

    const cell = spawnNearExisting({
      occupied,
      radius: 3,
      minSeparation: 2,
      random: firstChoice,
    });

    expect(cellDistance(cell, { x: 0, y: 0 })).toBeGreaterThanOrEqual(2);
  });

  it('never returns an occupied cell', () => {
    const occupied: Cell[] = [];

    for (let index = 0; index < 60; index += 1) {
      const cell = spawnNearExisting({
        occupied,
        radius: 1,
        random: { int: (max) => index % max },
      });

      expect(occupied.some((taken) => taken.x === cell.x && taken.y === cell.y)).toBe(false);
      occupied.push(cell);
    }
  });

  it('expands the radius when the neighbourhood is full', () => {
    // A full 3x3 block: every cell within radius 1 of the centre is taken.
    const occupied: Cell[] = [];
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        occupied.push({ x, y });
      }
    }

    const cell = spawnNearExisting({ occupied, radius: 1, random: firstChoice });

    expect(cellDistance(cell, { x: 0, y: 0 })).toBe(2);
  });
});
