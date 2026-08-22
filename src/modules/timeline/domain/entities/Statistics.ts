import type { SurfaceObjectKind } from '@/modules/surface-objects/domain/value-objects/SurfaceObjectKind';

export type SpaceStatistics = {
  readonly totalObjects: number;
  readonly byKind: Readonly<Record<SurfaceObjectKind, number>>;
  readonly favorites: number;
  /** -1 (only negative kinds) … 1 (only positive kinds). */
  readonly balance: number;
  readonly firstObjectAt: Date | null;
  readonly lastObjectAt: Date | null;
};
