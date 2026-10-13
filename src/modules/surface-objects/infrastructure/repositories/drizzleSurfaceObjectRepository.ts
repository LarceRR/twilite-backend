import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, lt, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { surfaceObjects, surfaces } from '@/database/schema';
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
  SurfaceCellSelector,
  SurfaceObjectRepository,
} from '../../domain/repositories/SurfaceObjectRepository';
import type { Cell } from '../../domain/value-objects/Cell';
import type { SurfaceObjectState } from '../../domain/value-objects/SurfaceObjectState';

type ObjectRow = typeof surfaceObjects.$inferSelect;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

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
          pixelObjectId: input.pixelObjectId ?? null,
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

  async insertAtNextCell(
    input: Omit<InsertSurfaceObjectInput, 'cell'>,
    maxObjects: number,
    selectCell: SurfaceCellSelector,
  ): Promise<SurfaceObject | null> {
    try {
      return await this.db.transaction((tx) => insertAtNextCell(tx, input, maxObjects, selectCell));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Ячейка уже занята', { surfaceId: input.surfaceId });
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
    const deleted = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .delete(surfaceObjects)
        .where(and(eq(surfaceObjects.id, id), eq(surfaceObjects.version, expectedVersion)))
        .returning({ surfaceId: surfaceObjects.surfaceId });
      if (row === undefined) return false;
      await tx
        .update(surfaces)
        .set({ version: sql`${surfaces.version} + 1` })
        .where(eq(surfaces.id, row.surfaceId));
      return true;
    });

    if (!deleted) {
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

async function insertAtNextCell(
  tx: Transaction,
  input: Omit<InsertSurfaceObjectInput, 'cell'>,
  maxObjects: number,
  selectCell: SurfaceCellSelector,
): Promise<SurfaceObject | null> {
  const surface = await lockSurface(tx, input.surfaceId);
  const occupied = await listOccupiedCells(tx, input.surfaceId);
  if (occupied.length >= maxObjects) return null;
  const cell = selectCell({
    generation: surface.spawnCount + 1,
    occupied,
    recentColumns: surface.recentSpawnColumns,
  });
  const object = await insertObject(tx, input, cell);
  await advanceSpawnState(tx, input.surfaceId, cell.x, surface.recentSpawnColumns);
  return object;
}

async function lockSurface(tx: Transaction, surfaceId: SurfaceId) {
  const [surface] = await tx
    .select({
      spawnCount: surfaces.spawnCount,
      recentSpawnColumns: surfaces.recentSpawnColumns,
    })
    .from(surfaces)
    .where(eq(surfaces.id, surfaceId))
    .for('update');
  if (surface === undefined) throw new InfrastructureError('Поверхность не найдена', { surfaceId });
  return surface;
}

async function listOccupiedCells(tx: Transaction, surfaceId: SurfaceId): Promise<Cell[]> {
  const rows = await tx
    .select({ x: surfaceObjects.cellX, y: surfaceObjects.cellY })
    .from(surfaceObjects)
    .where(eq(surfaceObjects.surfaceId, surfaceId));
  return rows.map((row) => ({ x: row.x, y: row.y }));
}

async function insertObject(
  tx: Transaction,
  input: Omit<InsertSurfaceObjectInput, 'cell'>,
  cell: Cell,
): Promise<SurfaceObject> {
  const [row] = await tx
    .insert(surfaceObjects)
    .values({
      ...input,
      cellX: cell.x,
      cellY: cell.y,
      pixelObjectId: input.pixelObjectId ?? null,
    })
    .returning();
  if (row === undefined) throw new InfrastructureError('Не удалось создать объект');
  return toSurfaceObject(row);
}

async function advanceSpawnState(
  tx: Transaction,
  surfaceId: SurfaceId,
  column: number,
  recentColumns: readonly number[],
): Promise<void> {
  await tx
    .update(surfaces)
    .set({
      spawnCount: sql`${surfaces.spawnCount} + 1`,
      recentSpawnColumns: [...recentColumns, column].slice(-3),
      version: sql`${surfaces.version} + 1`,
    })
    .where(eq(surfaces.id, surfaceId));
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
    pixelObjectId: row.pixelObjectId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}
