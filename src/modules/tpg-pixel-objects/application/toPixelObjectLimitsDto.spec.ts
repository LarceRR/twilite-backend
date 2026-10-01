import { describe, expect, it } from 'vitest';

import { loadLimits } from '@/config/limits';

import { toPixelObjectLimitsDto } from './toPixelObjectLimitsDto';

describe('toPixelObjectLimitsDto', () => {
  it('exposes canvas max 160 and live frame/sheet caps', () => {
    const dto = toPixelObjectLimitsDto(loadLimits({}));
    expect(dto.canvasMax).toBe(160);
    expect(dto.maxFrames).toBe(64);
    expect(dto.sheetMaxBytes).toBe(8 * 1024 * 1024);
    expect(dto.supportedFormat).toBe('twilite.pixelobject/v1');
    expect(dto.surfaceMax).toBeGreaterThan(0);
  });
});
