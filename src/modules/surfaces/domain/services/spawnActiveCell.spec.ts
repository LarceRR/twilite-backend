import { describe, expect, it } from 'vitest';

import type { RandomSource } from '@/shared/utils/random';

import {
  ACTIVE_ROW_CENTER,
  EDGE_ROWS_UNLOCK_GENERATION,
  EDGE_ROWS_UNLOCK_X,
  FIRST_SPAWN_X,
<<<<<<< HEAD
  SPAWN_SEARCH_WINDOW_WIDTH,
=======
  FIRST_SPAWN_Y,
>>>>>>> 918ec7516ac77b4fdf865c628a47967f25f6f1a7
  spawnActiveCell,
} from './spawnActiveCell';

const lastChoice: RandomSource = { int: (max) => max - 1 };
const firstChoice: RandomSource = { int: () => 0 };

describe('spawnActiveCell', () => {
<<<<<<< HEAD
  it('blocks cells within Manhattan distance four of an object', () => {
    const object = { x: 2, y: 7 };
    const isBlocked = (x: number, y: number) => isFalseCell({ x, y }, object);

    expect(isBlocked(2, 7)).toBe(true);
    expect(isBlocked(6, 7)).toBe(true);
    expect(isBlocked(4, 9)).toBe(true);
    expect(isBlocked(7, 7)).toBe(false);
    expect(isBlocked(5, 10)).toBe(false);
    expect(isBlocked(5, 9)).toBe(false);
  });

  it('starts at the canonical center cell (2, 7) regardless of randomness', () => {
=======
  it('restarts at the first-spawn coordinate when all objects were deleted, even with an old generation', () => {
    const cell = spawnActiveCell({
      generation: 42,
      occupied: [],
      recentColumns: [2, 3, 4],
      random: lastChoice,
    });

    expect(cell).toEqual({ x: FIRST_SPAWN_X, y: FIRST_SPAWN_Y });
  });

  it('starts at (2, 4) regardless of randomness', () => {
>>>>>>> 918ec7516ac77b4fdf865c628a47967f25f6f1a7
    const cell = spawnActiveCell({
      generation: 1,
      activeObjectCount: 0,
      lastSpawnX: null,
      lastSpawnY: null,
      occupiedCells: [],
      random: lastChoice,
    });

    expect(cell).toEqual({ x: FIRST_SPAWN_X, y: FIRST_SPAWN_Y });
  });

  it('restarts at the canonical center when the surface is empty after prior spawns', () => {
    const cell = spawnActiveCell({
      generation: 42,
      activeObjectCount: 0,
      lastSpawnX: 12,
      lastSpawnY: 8,
      occupiedCells: [],
      random: lastChoice,
    });

    expect(cell).toEqual({ x: FIRST_SPAWN_X, y: ACTIVE_ROW_CENTER });
  });

  it('can choose a free cell beyond the previous object, not only the next fixed column', () => {
    const cell = spawnActiveCell({
      generation: 2,
      activeObjectCount: 1,
      lastSpawnX: FIRST_SPAWN_X,
      lastSpawnY: ACTIVE_ROW_CENTER,
      occupiedCells: [{ x: FIRST_SPAWN_X, y: ACTIVE_ROW_CENTER }],
      random: firstChoice,
    });

    expect(cell).toEqual({ x: FIRST_SPAWN_X + 4, y: ACTIVE_ROW_CENTER - 1 });
  });

  it('advances beyond prior objects and avoids all of their false cells', () => {
    let lastSpawnX = FIRST_SPAWN_X;
    let lastSpawnY = ACTIVE_ROW_CENTER;
    const occupiedCells = [{ x: FIRST_SPAWN_X, y: ACTIVE_ROW_CENTER }];
    for (let generation = 2; generation <= 5; generation += 1) {
      const cell = spawnActiveCell({
        generation,
        activeObjectCount: generation - 1,
        lastSpawnX,
        lastSpawnY,
        occupiedCells,
        random: lastChoice,
      });
      expect(cell.x).toBeGreaterThan(lastSpawnX);
      expect(occupiedCells.some((occupied) => isFalseCell(cell, occupied))).toBe(false);
      expect(occupiedCells).not.toContainEqual(cell);
      occupiedCells.push(cell);
      lastSpawnX = cell.x;
      lastSpawnY = cell.y;
    }
  });

  it('keeps the outer rows unavailable during the first three generations', () => {
    let lastSpawnX: number | null = null;
    let lastSpawnY: number | null = null;
    const occupiedCells: { x: number; y: number }[] = [];
    for (let generation = 1; generation < EDGE_ROWS_UNLOCK_GENERATION; generation += 1) {
      const cell = spawnActiveCell({
        generation,
        activeObjectCount: generation - 1,
        lastSpawnX,
        lastSpawnY,
        occupiedCells,
        random: lastChoice,
      });
      expect([6, 7, 8]).toContain(cell.y);
      occupiedCells.push(cell);
      lastSpawnX = cell.x;
      lastSpawnY = cell.y;
    }
  });

  it('allows outer rows after three objects and when X exceeds eight', () => {
    const cell = spawnActiveCell({
      generation: EDGE_ROWS_UNLOCK_GENERATION,
      activeObjectCount: EDGE_ROWS_UNLOCK_GENERATION - 1,
      lastSpawnX: EDGE_ROWS_UNLOCK_X,
      lastSpawnY: ACTIVE_ROW_CENTER,
      occupiedCells: [{ x: EDGE_ROWS_UNLOCK_X, y: ACTIVE_ROW_CENTER }],
      random: lastChoice,
    });

    expect([5, 9]).toContain(cell.y);
  });

  it('keeps outer rows closed until X exceeds eight', () => {
    const cell = spawnActiveCell({
      generation: EDGE_ROWS_UNLOCK_GENERATION,
      activeObjectCount: EDGE_ROWS_UNLOCK_GENERATION - 1,
      lastSpawnX: EDGE_ROWS_UNLOCK_X - SPAWN_SEARCH_WINDOW_WIDTH - 1,
      lastSpawnY: ACTIVE_ROW_CENTER,
      occupiedCells: [
        { x: EDGE_ROWS_UNLOCK_X - SPAWN_SEARCH_WINDOW_WIDTH - 1, y: ACTIVE_ROW_CENTER },
      ],
      random: firstChoice,
    });

    expect([6, 7, 8]).toContain(cell.y);
  });
});

function isFalseCell(
  cell: { readonly x: number; readonly y: number },
  object: { readonly x: number; readonly y: number },
): boolean {
  const deltaX = Math.abs(cell.x - object.x);
  const deltaY = Math.abs(cell.y - object.y);
  return deltaX + deltaY <= 4;
}
