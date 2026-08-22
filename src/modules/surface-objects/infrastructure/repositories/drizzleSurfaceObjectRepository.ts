import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, lt } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { surfaceObjects } from '@/database/schema';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { SurfaceId } from '@/modules/surfaces/domain/value-objects/SurfaceId';
import { toUserId } from '@/modules/users/domain/value-objects/UserId';
import { ConflictError, InfrastructureError } from '@/shared/errors';

import type {
  SurfaceObject,
  SurfaceObjectId,
  SurfaceObjectMetadata,
} from '../../domain/entities/SurfaceObject';
import type {
  InsertSurfaceObjectInput,
  SurfaceObjectRepository,
} from '../../domain/repositories/SurfaceObjectRepository';
import type { Cell } from '../../domain/value-objects/Cell';
import type { SurfaceObjectState } from '../../domain/value-objects/SurfaceObjectState';

type ObjectRow = typeof surfaceObjects.$inferSelect;

/** Postgres error code for a unique constraint violation. */
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class DrizzleSurfaceObjectRepository implements SurfaceObjectRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listBySurface(surfaceId: SurfaceId): Promise<readonly SurfaceObject[]> {
    const rows = await this.db
      .select()
      .from(surfaceObjects)
      .where(eq(surfaceObjects.surfaceId, surfaceId))
      .orderBy(asc(surfaceObjects.createdAt));

    return rows.map(toSurfaceObject);
  }

  async listOccupiedCells(surfaceId: SurfaceId): Promise<readonly Cell[]> {
    const rows = await this.db
      .select({ x: surfaceObjects.cellX, y: surfaceObjects.cellY })
      .from(surfaceObjects)
      .where(eq(surfaceObjects.surfaceId, surfaceId));

    return rows.map((row) => ({ x: row.x, y: row.y }));
  }

  async findById(id: SurfaceObjectId): Promise<SurfaceObject | null> {
    const [row] = await this.db
      .select()
      .from(surfaceObjects)
      .where(eq(surfaceObjects.id, id))
      .limit(1);

    return row === undefined ? null : toSurfaceObject(row);
  }

  async insert(input: InsertSurfaceObjectInput): Promise<SurfaceObject> {
    try {
      const [row] = await this.db
        .insert(surfaceObjects)
        .values({
          spaceId: input.spaceId,
          surfaceId: input.surfaceId,
          cellX: input.cell.x,
          cellY: input.cell.y,
          kind: input.kind,
          state: input.state,
          createdByUserId: input.createdByUserId,
          subjectUserId: input.subjectUserId,
          metadata: input.metadata,
        })
        .returning();

      if (row === undefined) {
        throw new InfrastructureError('Не удалось создать объект');
      }

      return toSurfaceObject(row);
    } catch (error) {
      // Two clients raced for the same cell; the caller re-runs the spawn policy.
      if (isUniqueViolation(error)) {
        throw new ConflictError('Ячейка уже занята', {
          surfaceId: input.surfaceId,
          cell: input.cell,
        });
      }

      throw error;
    }
  }

  async update(object: SurfaceObject, expectedVersion: number): Promise<SurfaceObject> {
    const [row] = await this.db
      .update(surfaceObjects)
      .set({
        state: object.state,
        metadata: object.metadata,
        favorite: object.favorite,
        updatedAt: object.updatedAt,
        version: object.version,
      })
      .where(and(eq(surfaceObjects.id, object.id), eq(surfaceObjects.version, expectedVersion)))
      .returning();

    if (row === undefined) {
      throw new ConflictError('Объект был изменён', {
        objectId: object.id,
        expectedVersion,
      });
    }

    return toSurfaceObject(row);
  }

  async delete(id: SurfaceObjectId, expectedVersion: number): Promise<void> {
    const rows = await this.db
      .delete(surfaceObjects)
      .where(and(eq(surfaceObjects.id, id), eq(surfaceObjects.version, expectedVersion)))
      .returning({ id: surfaceObjects.id });

    if (rows.length === 0) {
      throw new ConflictError('Объект был изменён или уже удалён', {
        objectId: id,
        expectedVersion,
      });
    }
  }

  async listFadingBefore(threshold: Date, limit: number): Promise<readonly SurfaceObject[]> {
    const rows = await this.db
      .select()
      .from(surfaceObjects)
      .where(and(eq(surfaceObjects.state, 'Fading'), lt(surfaceObjects.updatedAt, threshold)))
      .orderBy(asc(surfaceObjects.updatedAt))
      .limit(limit);

    return rows.map(toSurfaceObject);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function toSurfaceObject(row: ObjectRow): SurfaceObject {
  return {
    id: row.id as SurfaceObjectId,
    spaceId: row.spaceId as SpaceId,
    surfaceId: row.surfaceId as SurfaceId,
    cell: { x: row.cellX, y: row.cellY },
    kind: row.kind,
    state: row.state as SurfaceObjectState,
    createdByUserId: toUserId(row.createdByUserId),
    subjectUserId: toUserId(row.subjectUserId),
    metadata: (row.metadata ?? {}) as SurfaceObjectMetadata,
    favorite: row.favorite,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}
