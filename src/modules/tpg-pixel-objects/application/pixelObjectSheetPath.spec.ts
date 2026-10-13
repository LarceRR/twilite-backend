import { describe, expect, it } from 'vitest';

import { pixelObjectSheetPath } from './pixelObjectSheetPath';

describe('pixelObjectSheetPath', () => {
  it('points at the revision sheet on the API', () => {
    expect(pixelObjectSheetPath('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 3)).toBe(
      '/v1/tpg/pixel-objects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/revisions/3/sheet',
    );
  });
});
