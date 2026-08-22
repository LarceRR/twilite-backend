import { ValidationError } from '@/shared/errors';

/** A position on the surface grid. Integers only: the grid has no sub-cells. */
export type Cell = {
  readonly x: number;
  readonly y: number;
};

export const originCell: Cell = { x: 0, y: 0 };

export function toCell(x: number, y: number): Cell {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new ValidationError('Координаты ячейки должны быть целыми', [
      { path: 'cell', message: 'Ожидаются целые числа' },
    ]);
  }

  return { x, y };
}

export type CellKey = `${number}:${number}`;

export function cellKey(cell: Cell): CellKey {
  return `${cell.x}:${cell.y}`;
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Chebyshev distance: the grid is 8-connected, so diagonal steps cost one. */
export function cellDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** All cells at exactly `radius` rings out from `center`. */
export function ringCells(center: Cell, radius: number): readonly Cell[] {
  if (radius <= 0) {
    return [center];
  }

  const cells: Cell[] = [];

  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) {
        cells.push({ x: center.x + dx, y: center.y + dy });
      }
    }
  }

  return cells;
}
