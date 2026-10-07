export type PixelObjectSheetStatus = 'pending' | 'published' | 'rejected' | 'archived';

export type PixelObjectSheetAccess = {
  readonly callerUserId: string;
  readonly authorUserId: string;
  readonly objectStatus: PixelObjectSheetStatus;
  readonly revisionStatus: PixelObjectSheetStatus;
  readonly canReadPublished: boolean;
  readonly canModerate: boolean;
};

/**
 * Published revisions are readable with the catalog permission.
 * Pending and rejected revisions stay with the author and moderators.
 * Archived objects are not served.
 */
export function canReadPixelObjectSheet(access: PixelObjectSheetAccess): boolean {
  if (access.objectStatus === 'archived') {
    return false;
  }
  if (access.callerUserId === access.authorUserId || access.canModerate) {
    return true;
  }
  return access.canReadPublished && access.revisionStatus === 'published';
}
