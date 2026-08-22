import {
  type Cell,
  cellDistance,
  cellKey,
  originCell,
  ringCells,
} from '@/modules/surface-objects/domain/value-objects/Cell';
import { DomainError } from '@/shared/errors';
import { pickOne, type RandomSource } from '@/shared/utils/random';

const MAX_RADIUS_EXPANSIONS = 24;

/**
 * Where a new object appears. The client never picks a cell: position is a domain
 * decision, so the surface grows organically as a cluster instead of a grid the
 * user fills in.
 *
 * Candidates are empty cells within `radius` of the preferred `near` cell (or of
 * any occupied one); if that neighbourhood is full the radius grows until a free
 * cell is found.
 *
 * `minSeparation` is Chebyshev distance: 2 means none of the 8 neighbouring
 * cells may already hold an object.
 */
export function spawnNearExisting(params: {
  readonly occupied: readonly Cell[];
  readonly radius: number;
  readonly random: RandomSource;
  /** Prefer free cells near this anchor (typically the last created object). */
  readonly near?: Cell;
  /** Minimum Chebyshev distance to every occupied cell (default 1 = cell free). */
  readonly minSeparation?: number;
}): Cell {
  const { occupied, radius, random } = params;
  const minSeparation = params.minSeparation ?? 1;

  if (occupied.length === 0) {
    return originCell;
  }

  const taken = new Set(occupied.map(cellKey));
  const anchors: readonly Cell[] = params.near !== undefined ? [params.near] : occupied;
  const searchFloor = Math.max(1, minSeparation);

  for (let expansion = 0; expansion < MAX_RADIUS_EXPANSIONS; expansion += 1) {
    const candidates = collectCandidates(
      anchors,
      searchFloor + expansion,
      Math.max(radius, searchFloor) + expansion,
      taken,
      occupied,
      minSeparation,
    );
    const chosen = pickOne(candidates, random);

    if (chosen !== null) {
      return chosen;
    }
  }

  throw new DomainError('Не удалось найти свободную ячейку на поверхности', {
    occupiedCount: occupied.length,
    radius,
  });
}

function collectCandidates(
  anchors: readonly Cell[],
  minRing: number,
  maxRing: number,
  taken: ReadonlySet<string>,
  occupied: readonly Cell[],
  minSeparation: number,
): readonly Cell[] {
  const seen = new Set<string>();
  const candidates: Cell[] = [];

  for (const anchor of anchors) {
    for (let ring = minRing; ring <= maxRing; ring += 1) {
      for (const cell of ringCells(anchor, ring)) {
        const key = cellKey(cell);

        if (taken.has(key) || seen.has(key)) {
          continue;
        }

        if (!isSeparated(cell, occupied, minSeparation)) {
          continue;
        }

        seen.add(key);
        candidates.push(cell);
      }
    }
  }

  return candidates;
}

function isSeparated(candidate: Cell, occupied: readonly Cell[], minSeparation: number): boolean {
  for (const cell of occupied) {
    if (cellDistance(candidate, cell) < minSeparation) {
      return false;
    }
  }

  return true;
}
