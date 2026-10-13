import { type Cell, cellKey, toCell } from '@/modules/surface-objects/domain/value-objects/Cell';
import { DomainError } from '@/shared/errors';
import { pickOne, type RandomSource } from '@/shared/utils/random';

export const ACTIVE_ROW_CENTER = 7;
export const ACTIVE_ROW_EDGE = 2;
export const ACTIVE_CELL_MIN_X = 0;
export const FIRST_SPAWN_X = 2;
export const FIRST_SPAWN_ROWS = [ACTIVE_ROW_CENTER - 1, ACTIVE_ROW_CENTER, ACTIVE_ROW_CENTER + 1];
export const EDGE_ROWS_UNLOCK_GENERATION = 9;
export const COLUMN_COOLDOWN_SPAWNS = 3;
export const COLUMN_COOLDOWN_MAX_X = 5;

export function spawnActiveCell(params: {
  readonly generation: number;
  readonly occupied: readonly Cell[];
  readonly recentColumns: readonly number[];
  readonly random: RandomSource;
}): Cell {
  if (!Number.isInteger(params.generation) || params.generation < 1) {
    throw new DomainError('Номер генерации должен быть положительным целым числом');
  }
  if (params.generation === 1) {
    return firstSpawn(params.random);
  }

  const rows = activeRows(params.generation);
  const occupiedKeys = new Set(params.occupied.map(cellKey));
  const coolingColumns = new Set(params.recentColumns.slice(-COLUMN_COOLDOWN_SPAWNS));
  const maxColumn = nextSearchColumn(params.occupied, params.recentColumns);
  const candidates = collectCandidates(maxColumn, rows, occupiedKeys, coolingColumns);
  const chosen = pickOne(candidates, params.random);
  if (chosen !== null) return chosen;

  throw new DomainError('Не удалось найти свободную активную ячейку', {
    generation: params.generation,
  });
}

function firstSpawn(random: RandomSource): Cell {
  const row = FIRST_SPAWN_ROWS[random.int(FIRST_SPAWN_ROWS.length)];
  if (row === undefined) throw new DomainError('Не удалось выбрать стартовый ряд');
  return toCell(FIRST_SPAWN_X, row);
}

function activeRows(generation: number): readonly number[] {
  const span = generation < EDGE_ROWS_UNLOCK_GENERATION ? ACTIVE_ROW_EDGE - 1 : ACTIVE_ROW_EDGE;
  return Array.from({ length: span * 2 + 1 }, (_, index) => ACTIVE_ROW_CENTER - span + index);
}

function nextSearchColumn(occupied: readonly Cell[], recentColumns: readonly number[]): number {
  const farthest = Math.max(FIRST_SPAWN_X, ...occupied.map((cell) => cell.x), ...recentColumns);
  return farthest + 1;
}

function collectCandidates(
  maxColumn: number,
  rows: readonly number[],
  occupiedKeys: ReadonlySet<string>,
  coolingColumns: ReadonlySet<number>,
): readonly Cell[] {
  const candidates: Cell[] = [];
  for (let x = ACTIVE_CELL_MIN_X; x <= maxColumn; x += 1) {
    if (x <= COLUMN_COOLDOWN_MAX_X && coolingColumns.has(x)) continue;
    for (const y of rows) {
      const cell = toCell(x, y);
      if (!occupiedKeys.has(cellKey(cell))) candidates.push(cell);
    }
  }
  return candidates;
}
