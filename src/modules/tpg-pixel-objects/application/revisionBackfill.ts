import { createHash } from 'node:crypto';

export type PixelObjectHeadStatus = 'pending' | 'published' | 'rejected';

export type RevisionPointerTargets = {
  readonly setPublishedRevision: boolean;
  readonly setPendingRevision: boolean;
};

/**
 * Maps legacy single-row head status onto revision pointers (P2-S1 dual-write).
 * Published heads keep the live pointer; pending/rejected become the pending slot.
 */
export function mapHeadStatusToRevisionPointers(
  status: PixelObjectHeadStatus,
): RevisionPointerTargets {
  if (status === 'published') {
    return { setPublishedRevision: true, setPendingRevision: false };
  }
  return { setPublishedRevision: false, setPendingRevision: true };
}

export function revisionContentHash(manifestJson: string, sheetMediaId: string): string {
  return createHash('sha256').update(manifestJson).update('\0').update(sheetMediaId).digest('hex');
}
