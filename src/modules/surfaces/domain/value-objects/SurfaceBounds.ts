import type { Cell } from '@/modules/surface-objects/domain/value-objects/Cell';

export type SurfaceBounds = {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
};

export const emptyBounds: SurfaceBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

/**
 * The grid is never stored cell by cell: empty cells do not exist. Bounds are
 * derived from the objects that are actually there, which is also what the
 * client needs to size the visible surface.
 */
export function boundsFromCells(cells: readonly Cell[]): SurfaceBounds {
  const first = cells[0];

  if (first === undefined) {
    return emptyBounds;
  }

  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;

  for (const cell of cells) {
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minY = Math.min(minY, cell.y);
    maxY = Math.max(maxY, cell.y);
  }

  return { minX, maxX, minY, maxY };
}
