import { describe, expect, it } from 'vitest';

import { canReadPixelObjectSheet, type PixelObjectSheetAccess } from './canReadPixelObjectSheet';

const base: PixelObjectSheetAccess = {
  callerUserId: 'reader',
  authorUserId: 'author',
  objectStatus: 'published',
  revisionStatus: 'published',
  canReadPublished: false,
  canModerate: false,
};

describe('canReadPixelObjectSheet', () => {
  it('lets catalog readers load a published revision', () => {
    expect(canReadPixelObjectSheet({ ...base, canReadPublished: true })).toBe(true);
  });

  it('hides a pending resubmit from catalog readers', () => {
    expect(
      canReadPixelObjectSheet({
        ...base,
        canReadPublished: true,
        revisionStatus: 'pending',
      }),
    ).toBe(false);
  });

  it('lets the author load pending and rejected revisions', () => {
    expect(
      canReadPixelObjectSheet({
        ...base,
        callerUserId: 'author',
        revisionStatus: 'pending',
        objectStatus: 'pending',
      }),
    ).toBe(true);
    expect(
      canReadPixelObjectSheet({
        ...base,
        callerUserId: 'author',
        revisionStatus: 'rejected',
        objectStatus: 'rejected',
      }),
    ).toBe(true);
  });

  it('lets a moderator load the queue', () => {
    expect(
      canReadPixelObjectSheet({
        ...base,
        canModerate: true,
        revisionStatus: 'pending',
        objectStatus: 'pending',
      }),
    ).toBe(true);
  });

  it('does not serve archived objects', () => {
    expect(
      canReadPixelObjectSheet({
        ...base,
        callerUserId: 'author',
        canModerate: true,
        objectStatus: 'archived',
      }),
    ).toBe(false);
  });
});
