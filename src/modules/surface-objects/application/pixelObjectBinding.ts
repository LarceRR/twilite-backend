import { LEGACY_PIXEL_OBJECT_METADATA_KEY } from '@twilite/contracts';
import { eq } from 'drizzle-orm';

import type { Database } from '@/database/drizzle/drizzle.module';
import { pixelObjects } from '@/database/schema';
import { DomainError, ValidationError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolvePixelObjectIdFromCreate(input: {
  readonly pixelObjectId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}): string | null {
  if (typeof input.pixelObjectId === 'string' && input.pixelObjectId.length > 0) {
    return input.pixelObjectId;
  }
  const legacy = input.metadata[LEGACY_PIXEL_OBJECT_METADATA_KEY];
  if (typeof legacy === 'string' && UUID_RE.test(legacy)) {
    return legacy;
  }
  return null;
}

export async function assertPublishedPixelObject(
  db: Database,
  pixelObjectId: string,
): Promise<void> {
  const [row] = await db
    .select({
      id: pixelObjects.id,
      publishedRevisionId: pixelObjects.publishedRevisionId,
    })
    .from(pixelObjects)
    .where(eq(pixelObjects.id, pixelObjectId))
    .limit(1);

  if (row === undefined || row.publishedRevisionId === null) {
    throw new DomainError(
      'Пиксельный объект не опубликован',
      { pixelObjectId, code: 'PIXEL_OBJECT_NOT_PUBLISHED' },
      { code: ErrorCode.DOMAIN_RULE_VIOLATION, httpStatus: 422 },
    );
  }
}

export function assertMetadataBindingImmutable(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): void {
  const beforeId = before[LEGACY_PIXEL_OBJECT_METADATA_KEY];
  const afterId = after[LEGACY_PIXEL_OBJECT_METADATA_KEY];
  if (beforeId !== afterId) {
    throw new ValidationError('Привязку pixelObjectId нельзя менять', [
      { path: 'metadata.pixelObjectId', message: 'Создайте новый объект поверхности' },
    ]);
  }
}
