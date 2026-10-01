import { type Cell, cellKey, toCell } from '@/modules/surface-objects/domain/value-objects/Cell';
import { DomainError } from '@/shared/errors';
import type { RandomSource } from '@/shared/utils/random';

/** Five-lane bridge: x is column 0..4, y is row into the distance. */
export const BRIDGE_COLUMN_COUNT = 5;
export const BRIDGE_CENTER_COLUMN = 2;

/**
 * First object: front row, center lane. Each next object: next row, random lane
 * different from the previous spawn's column.
 */
export function spawnBridgeRow(params: {
  readonly occupied: readonly Cell[];
  readonly random: RandomSource;
  /** Most recently created object (by createdAt). */
  readonly lastCreated?: Cell;
}): Cell {
  const taken = new Set(params.occupied.map(cellKey));

  if (params.occupied.length === 0) {
    return toCell(BRIDGE_CENTER_COLUMN, 0);
  }

  if (params.lastCreated === undefined) {
    throw new DomainError('Не удалось определить предыдущую ячейку');
  }

  const row = params.lastCreated.y + 1;
  const forbidden = params.lastCreated.x;
  const columns = Array.from({ length: BRIDGE_COLUMN_COUNT }, (_, index) => index).filter(
    (column) => column !== forbidden,
  );

  const shuffled = [...columns];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = params.random.int(index + 1);
    const temp = shuffled[index];
    shuffled[index] = shuffled[swap] ?? temp;
    shuffled[swap] = temp;
  }

  for (const column of shuffled) {
    const candidate = toCell(column, row);
    if (!taken.has(cellKey(candidate))) {
      return candidate;
    }
  }

  throw new DomainError('Не удалось найти свободную ячейку на мосту', {
    row,
    occupiedCount: params.occupied.length,
  });
}
