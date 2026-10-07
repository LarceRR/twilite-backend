import { type SQL, sql } from 'drizzle-orm';

/** Author may erase the row only when the object has never been published. */
export function authorHardDeletes(head: {
  readonly publishedRevisionId: string | null;
  readonly status: string;
}): boolean {
  return head.publishedRevisionId === null && head.status !== 'published';
}

/**
 * Author lists must not present an archived head as its still-published revision.
 * The SQL fragment in `authorFacingStatusSql` mirrors this rule.
 */
export function authorFacingStatus<T extends string>(headStatus: T, revisionStatus: T | null): T {
  if (headStatus === 'archived') {
    return headStatus;
  }
  return revisionStatus ?? headStatus;
}

export function authorFacingStatusSql<T>(revisionStatus: unknown, headStatus: unknown): SQL<T> {
  return sql<T>`case when ${headStatus} = 'archived' then ${headStatus} else coalesce(${revisionStatus}, ${headStatus}) end`;
}

export type RevisionMediaRef = {
  readonly sheetMediaId: string;
  readonly previewMediaId: string | null;
};

export function collectPixelObjectMediaIds(
  headSheetMediaId: string,
  revisions: readonly RevisionMediaRef[],
): string[] {
  const ids = new Set<string>([headSheetMediaId]);
  for (const revision of revisions) {
    ids.add(revision.sheetMediaId);
    if (revision.previewMediaId !== null) {
      ids.add(revision.previewMediaId);
    }
  }
  return [...ids];
}

export function mediaIdsSafeToDelete(
  candidates: readonly string[],
  stillReferenced: ReadonlySet<string>,
): string[] {
  return candidates.filter((id) => !stillReferenced.has(id));
}

export function stripPixelObjectMetadata(
  metadata: unknown,
  pixelObjectId: string,
): Record<string, unknown> {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  const next = { ...(metadata as Record<string, unknown>) };
  if (next['pixelObjectId'] === pixelObjectId) {
    delete next['pixelObjectId'];
  }
  return next;
}
