import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { SurfaceId } from '@/modules/surfaces/domain/value-objects/SurfaceId';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';

import type {
  SurfaceObject,
  SurfaceObjectId,
  SurfaceObjectMetadata,
} from '../entities/SurfaceObject';
import type { Cell } from '../value-objects/Cell';
import type { SurfaceObjectKind } from '../value-objects/SurfaceObjectKind';
import type { SurfaceObjectState } from '../value-objects/SurfaceObjectState';

export type InsertSurfaceObjectInput = {
  readonly spaceId: SpaceId;
  readonly surfaceId: SurfaceId;
  readonly cell: Cell;
  readonly kind: SurfaceObjectKind;
  readonly state: SurfaceObjectState;
  readonly createdByUserId: UserId;
  readonly subjectUserId: UserId;
  readonly metadata: SurfaceObjectMetadata;
};

export interface SurfaceObjectRepository {
  listBySurface(surfaceId: SurfaceId): Promise<readonly SurfaceObject[]>;
  listOccupiedCells(surfaceId: SurfaceId): Promise<readonly Cell[]>;
  findById(id: SurfaceObjectId): Promise<SurfaceObject | null>;

  /**
   * Rejects a taken cell at the database level (unique index), so two concurrent
   * creates can never both win the same cell.
   */
  insert(input: InsertSurfaceObjectInput): Promise<SurfaceObject>;

  /** Persists an already-validated aggregate; fails on a version mismatch. */
  update(object: SurfaceObject, expectedVersion: number): Promise<SurfaceObject>;

  delete(id: SurfaceObjectId, expectedVersion: number): Promise<void>;

  /** Drives the scheduled `age` transition. */
  listFadingBefore(threshold: Date, limit: number): Promise<readonly SurfaceObject[]>;
}

export const SURFACE_OBJECT_REPOSITORY = Symbol('SURFACE_OBJECT_REPOSITORY');
