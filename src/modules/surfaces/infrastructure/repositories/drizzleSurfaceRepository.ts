import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { surfaces } from '@/database/schema';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import { InfrastructureError, NotFoundError } from '@/shared/errors';

import type { Surface } from '../../domain/entities/Surface';
import type { SurfaceRepository } from '../../domain/repositories/SurfaceRepository';
import type { SurfaceId } from '../../domain/value-objects/SurfaceId';

type SurfaceRow = typeof surfaces.$inferSelect;

@Injectable()
export class DrizzleSurfaceRepository implements SurfaceRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findBySpaceId(spaceId: SpaceId): Promise<Surface | null> {
    const [row] = await this.db
      .select()
      .from(surfaces)
      .where(eq(surfaces.spaceId, spaceId))
      .limit(1);

    return row === undefined ? null : toSurface(row);
  }

  async create(spaceId: SpaceId): Promise<Surface> {
    // Idempotent: a retried space creation must not fail on the unique index.
    const [row] = await this.db
      .insert(surfaces)
      .values({ spaceId })
      .onConflictDoNothing({ target: surfaces.spaceId })
      .returning();

    if (row !== undefined) {
      return toSurface(row);
    }

    const existing = await this.findBySpaceId(spaceId);

    if (existing === null) {
      throw new InfrastructureError('Не удалось создать поверхность', { spaceId });
    }

    return existing;
  }

  async touch(id: SurfaceId): Promise<Surface> {
    const [row] = await this.db
      .update(surfaces)
      .set({ version: sql`${surfaces.version} + 1` })
      .where(eq(surfaces.id, id))
      .returning();

    if (row === undefined) {
      throw new NotFoundError('Поверхность не найдена', { surfaceId: id });
    }

    return toSurface(row);
  }
}

function toSurface(row: SurfaceRow): Surface {
  return {
    id: row.id as SurfaceId,
    spaceId: row.spaceId as SpaceId,
    createdAt: row.createdAt,
    version: row.version,
  };
}
