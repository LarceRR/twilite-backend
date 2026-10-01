import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets, pixelObjectRevisions } from '@/database/schema';
import { STORAGE, type StoragePort } from '@/infrastructure/storage/StoragePort';

export type MediaGcReport = {
  readonly dryRun: boolean;
  readonly pendingDeleted: number;
  readonly orphanSheetsDeleted: number;
};

/** P2-S9: expire unconfirmed uploads and unused pixel sheets. */
@Injectable()
export class MediaGcService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly logger: Logger,
  ) {}

  async run(options: { readonly dryRun: boolean } = { dryRun: true }): Promise<MediaGcReport> {
    const pendingDeleted = await this.gcPendingUploads(options.dryRun);
    const orphanSheetsDeleted = await this.gcOrphanSheets(options.dryRun);
    this.logger.log(
      { dryRun: options.dryRun, pendingDeleted, orphanSheetsDeleted },
      'media_gc_completed',
    );
    return { dryRun: options.dryRun, pendingDeleted, orphanSheetsDeleted };
  }

  private async gcPendingUploads(dryRun: boolean): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.status, 'pending'), lt(mediaAssets.createdAt, cutoff)));

    if (dryRun) {
      return rows.length;
    }
    for (const row of rows) {
      await this.storage.delete(row.storageKey).catch(() => undefined);
      await this.db.delete(mediaAssets).where(eq(mediaAssets.id, row.id));
    }
    return rows.length;
  }

  private async gcOrphanSheets(dryRun: boolean): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const referenced = this.db
      .select({ id: pixelObjectRevisions.sheetMediaId })
      .from(pixelObjectRevisions);
    const previewReferenced = this.db
      .select({ id: pixelObjectRevisions.previewMediaId })
      .from(pixelObjectRevisions)
      .where(sql`${pixelObjectRevisions.previewMediaId} is not null`);

    const rows = await this.db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.kind, 'pixel-sheet'),
          eq(mediaAssets.status, 'ready'),
          lt(mediaAssets.createdAt, cutoff),
          notInArray(mediaAssets.id, referenced),
        ),
      );

    void previewReferenced;
    void or;
    void isNull;

    if (dryRun) {
      return rows.length;
    }
    for (const row of rows) {
      await this.storage.delete(row.storageKey).catch(() => undefined);
      await this.db.delete(mediaAssets).where(eq(mediaAssets.id, row.id));
    }
    return rows.length;
  }
}
