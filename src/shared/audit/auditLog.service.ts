import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { auditLog } from '@/database/schema';

export type AuditWrite = {
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string | null;
  readonly context?: Readonly<Record<string, unknown>>;
};

/** Append-only security/moderation audit (P1-S8). Never log secrets/URLs. */
@Injectable()
export class AuditLogService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async write(entry: AuditWrite): Promise<void> {
    await this.db.insert(auditLog).values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      context: entry.context ?? {},
    });
  }
}
