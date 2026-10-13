import { describe, expect, it } from 'vitest';

import type { Cell } from '@/modules/surface-objects/domain/value-objects/Cell';
import type { RandomSource } from '@/shared/utils/random';

import {
  ACTIVE_ROW_CENTER,
  COLUMN_COOLDOWN_MAX_X,
  COLUMN_COOLDOWN_SPAWNS,
  EDGE_ROWS_UNLOCK_GENERATION,
  FIRST_SPAWN_X,
  spawnActiveCell,
} from './spawnActiveCell';

const firstChoice: RandomSource = { int: () => 0 };
const lastChoice: RandomSource = { int: (max) => max - 1 };

describe('spawnActiveCell', () => {
  it('restarts from the center when all objects were deleted, even with an old generation', () => {
    const cell = spawnActiveCell({
      generation: 42,
      occupied: [],
      recentColumns: [2, 3, 4],
      random: lastChoice,
    });

    expect(cell).toEqual({ x: FIRST_SPAWN_X, y: ACTIVE_ROW_CENTER });
  });

  it('starts at the canonical center cell (3, 8) regardless of randomness', () => {
    const cell = spawnActiveCell({
      generation: 1,
      occupied: [],
      recentColumns: [],
      random: lastChoice,
    });

    expect(cell).toEqual({ x: FIRST_SPAWN_X, y: ACTIVE_ROW_CENTER });
  });

  it('keeps the outer active rows closed through the first eight generations', () => {
    for (let generation = 1; generation < EDGE_ROWS_UNLOCK_GENERATION; generation += 1) {
      const cell = spawnActiveCell({
        generation,
        occupied: [{ x: FIRST_SPAWN_X, y: ACTIVE_ROW_CENTER }],
        recentColumns: [FIRST_SPAWN_X],
        random: lastChoice,
      });
      expect([6, 7, 8]).toContain(cell.y);
    }
  });

  it('allows the outer active rows starting with generation nine', () => {
    const cell = spawnActiveCell({
      generation: EDGE_ROWS_UNLOCK_GENERATION,
      occupied: [{ x: FIRST_SPAWN_X, y: ACTIVE_ROW_CENTER }],
      recentColumns: [FIRST_SPAWN_X],
      random: lastChoice,
    });

    expect([5, 9]).toContain(cell.y);
  });

  it('does not reuse a recent column while it is within the first six columns', () => {
    const occupied: Cell[] = [{ x: 2, y: 6 }];
    const cell = spawnActiveCell({
      generation: 2,
      occupied,
      recentColumns: [2],
      random: firstChoice,
    });

    expect(cell.x).not.toBe(2);
    expect(cell.x).toBeGreaterThanOrEqual(FIRST_SPAWN_X);
  });

  it('releases a column after it falls out of the three-spawn history', () => {
    const occupied: Cell[] = [];
    for (let x = 0; x <= COLUMN_COOLDOWN_MAX_X; x += 1) {
      for (let y = 5; y <= 9; y += 1) {
        if (x !== 2 || y !== 6) occupied.push({ x, y });
      }
    }
    const cell = spawnActiveCell({
      generation: 10,
      occupied,
      recentColumns: [3, 4, 1],
      random: firstChoice,
    });

    expect(cell).toEqual({ x: 2, y: 6 });
  });

  it('permits reuse after the three-spawn cooldown once x is greater than five', () => {
    const occupied: Cell[] = [];
    for (let x = 0; x <= COLUMN_COOLDOWN_MAX_X; x += 1) {
      for (let y = 5; y <= 9; y += 1) occupied.push({ x, y });
    }

    const cell = spawnActiveCell({
      generation: 9,
      occupied,
      recentColumns: [1, 4, 6].slice(-COLUMN_COOLDOWN_SPAWNS),
      random: firstChoice,
    });

    expect(cell.x).toBe(6);
  });

  it('never returns an occupied cell', () => {
    const occupied: Cell[] = [{ x: 2, y: 6 }];
    const cell = spawnActiveCell({
      generation: 2,
      occupied,
      recentColumns: [2],
      random: lastChoice,
    });

    expect(occupied).not.toContainEqual(cell);
  });
});
