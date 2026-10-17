import { type Cell, toCell } from '@/modules/surface-objects/domain/value-objects/Cell';
import { DomainError } from '@/shared/errors';
import { pickOne, type RandomSource } from '@/shared/utils/random';

export const ACTIVE_ROW_CENTER = 7;
export const ACTIVE_ROW_EDGE = 2;
export const ACTIVE_CELL_MIN_X = 0;
export const FIRST_SPAWN_X = 2;
export const EDGE_ROWS_UNLOCK_GENERATION = 4;
export const EDGE_ROWS_UNLOCK_X = 8;
export const SPAWN_SEARCH_WINDOW_WIDTH = 3;
const FALSE_CELL_RADIUS = 4;

export function spawnActiveCell(params: {
  readonly generation: number;
  readonly activeObjectCount: number;
  readonly lastSpawnX: number | null;
  readonly lastSpawnY: number | null;
  readonly occupiedCells: readonly Cell[];
  readonly random: RandomSource;
}): Cell {
  if (!Number.isInteger(params.generation) || params.generation < 1) {
    throw new DomainError('Номер генерации должен быть положительным целым числом');
  }
  if (params.activeObjectCount === 0) {
    return firstSpawn();
  }

  const firstX = (params.lastSpawnX ?? FIRST_SPAWN_X) + 1;
  for (let windowX = firstX; ; windowX += SPAWN_SEARCH_WINDOW_WIDTH) {
    const candidates = [];
    for (let x = windowX; x < windowX + SPAWN_SEARCH_WINDOW_WIDTH; x += 1) {
      for (const y of activeRows(params.generation, x)) {
        const cell = toCell(x, y);
        if (!isUnavailable(cell, params.occupiedCells)) candidates.push(cell);
      }
    }

    const chosen = pickOne(candidates, params.random);
    if (chosen !== null) return chosen;
  }
}

function firstSpawn(): Cell {
  return toCell(FIRST_SPAWN_X, ACTIVE_ROW_CENTER);
}

function activeRows(generation: number, x: number): readonly number[] {
  const unlockEdges = generation >= EDGE_ROWS_UNLOCK_GENERATION && x > EDGE_ROWS_UNLOCK_X;
  const span = unlockEdges ? ACTIVE_ROW_EDGE : ACTIVE_ROW_EDGE - 1;
  return Array.from({ length: span * 2 + 1 }, (_, index) => ACTIVE_ROW_CENTER - span + index);
}

function isUnavailable(cell: Cell, occupiedCells: readonly Cell[]): boolean {
  return occupiedCells.some((occupied) => {
    const distance = Math.abs(cell.x - occupied.x) + Math.abs(cell.y - occupied.y);
    return distance <= FALSE_CELL_RADIUS;
  });
}
