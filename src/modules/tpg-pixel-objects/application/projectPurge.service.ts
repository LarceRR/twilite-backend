import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets, pixelObjects, tpgProjects } from '@/database/schema';
import { STORAGE, type StoragePort } from '@/infrastructure/storage/StoragePort';
import { ProjectsService } from '@/modules/tpg-projects/application/projects.service';
import { AuditLogService } from '@/shared/audit/auditLog.service';
import { ConflictError } from '@/shared/errors';

import { PixelObjectsService } from './pixelObjects.service';

/**
 * Admin hard delete of a TPG project: every pixel object (revisions, media, surface
 * placements) is purged first, then the project row and its avatar file.
 *
 * Lives in the pixel-objects module because `pixel_objects.project_id` is
 * `ON DELETE RESTRICT` and object purge logic belongs to PixelObjectsService.
 */
@Injectable()
export class ProjectPurgeService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly projects: ProjectsService,
    private readonly objects: PixelObjectsService,
    private readonly audit: AuditLogService,
    private readonly logger: Logger,
  ) {}

  async purge(actorUserId: string, projectId: string): Promise<void> {
    const project = await this.projects.requireProjectRow(projectId);

    const objectRows = await this.db
      .select({ id: pixelObjects.id })
      .from(pixelObjects)
      .where(eq(pixelObjects.projectId, projectId));

    for (const row of objectRows) {
      await this.objects.purge(actorUserId, row.id);
    }

    const avatarStorageKey = await this.db.transaction(async (tx) => {
      const [remaining] = await tx
        .select({ value: count() })
        .from(pixelObjects)
        .where(eq(pixelObjects.projectId, projectId));
      if (Number(remaining?.value ?? 0) > 0) {
        throw new ConflictError('В проект добавили новые объекты, повторите удаление', {
          code: 'PROJECT_PURGE_RACE',
        });
      }

      await tx.delete(tpgProjects).where(eq(tpgProjects.id, projectId));

      if (project.avatarMediaId === null) {
        return null;
      }
      const [stillUsed] = await tx
        .select({ value: count() })
        .from(tpgProjects)
        .where(eq(tpgProjects.avatarMediaId, project.avatarMediaId));
      if (Number(stillUsed?.value ?? 0) > 0) {
        return null;
      }
      const [asset] = await tx
        .delete(mediaAssets)
        .where(eq(mediaAssets.id, project.avatarMediaId))
        .returning({ storageKey: mediaAssets.storageKey });
      return asset?.storageKey ?? null;
    });

    if (avatarStorageKey !== null) {
      try {
        await this.storage.delete(avatarStorageKey);
      } catch (error) {
        this.logger.error(
          { err: error, projectId, storageKey: avatarStorageKey },
          'tpg_project_avatar_storage_delete_failed',
        );
      }
    }

    await this.audit.write({
      actorUserId,
      action: 'tpg_project.purge',
      resource: 'tpg_project',
      resourceId: projectId,
      context: {
        ownerId: project.ownerId,
        objectCount: objectRows.length,
        wasReassignmentInbox: project.isReassignmentInbox,
      },
    });
  }
}
