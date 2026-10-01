import { describe, expect, it } from 'vitest';

import { decodeCatalogCursor, encodeCatalogCursor } from './catalogCursor';
import { authorCursorWhere, publishedCursorWhere } from './pixelObjectQueries';

describe('catalogCursor (P2-S4)', () => {
  it('round-trips publishedAt and id', () => {
    const encoded = encodeCatalogCursor({
      publishedAt: '2026-10-01T12:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
    });
    expect(decodeCatalogCursor(encoded)).toEqual({
      publishedAt: '2026-10-01T12:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('returns null for garbage', () => {
    expect(decodeCatalogCursor('%%%')).toBeNull();
    expect(decodeCatalogCursor('nospacer')).toBeNull();
  });

  it('builds keyset filters for published and author lists', () => {
    const cursor = {
      publishedAt: '2026-10-01T12:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
    };
    expect(publishedCursorWhere(cursor)).toBeTruthy();
    expect(authorCursorWhere(cursor)).toBeTruthy();
  });
});
