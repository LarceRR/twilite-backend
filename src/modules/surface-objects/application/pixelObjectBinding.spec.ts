import { describe, expect, it } from 'vitest';

import {
  assertMetadataBindingImmutable,
  resolvePixelObjectIdFromCreate,
} from './pixelObjectBinding';

describe('pixelObjectBinding (P2-S6)', () => {
  it('prefers explicit pixelObjectId over metadata', () => {
    expect(
      resolvePixelObjectIdFromCreate({
        pixelObjectId: '11111111-1111-4111-8111-111111111111',
        metadata: { pixelObjectId: '22222222-2222-4222-8222-222222222222' },
      }),
    ).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('reads legacy metadata key', () => {
    expect(
      resolvePixelObjectIdFromCreate({
        metadata: { pixelObjectId: '22222222-2222-4222-8222-222222222222' },
      }),
    ).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('rejects metadata binding changes on PATCH', () => {
    expect(() =>
      assertMetadataBindingImmutable({ pixelObjectId: 'a' }, { pixelObjectId: 'b' }),
    ).toThrow(/pixelObjectId/);
  });
});
