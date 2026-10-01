import { describe, expect, it } from 'vitest';

import { mapHeadStatusToRevisionPointers, revisionContentHash } from './revisionBackfill';

describe('revisionBackfill', () => {
  it('points published heads at published_revision_id only', () => {
    expect(mapHeadStatusToRevisionPointers('published')).toEqual({
      setPublishedRevision: true,
      setPendingRevision: false,
    });
  });

  it('points pending and rejected heads at pending_revision_id', () => {
    expect(mapHeadStatusToRevisionPointers('pending')).toEqual({
      setPublishedRevision: false,
      setPendingRevision: true,
    });
    expect(mapHeadStatusToRevisionPointers('rejected')).toEqual({
      setPublishedRevision: false,
      setPendingRevision: true,
    });
  });

  it('hashes manifest and sheet media id stably', () => {
    const first = revisionContentHash('{"a":1}', '11111111-1111-1111-1111-111111111111');
    const second = revisionContentHash('{"a":1}', '11111111-1111-1111-1111-111111111111');
    const other = revisionContentHash('{"a":2}', '11111111-1111-1111-1111-111111111111');
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
