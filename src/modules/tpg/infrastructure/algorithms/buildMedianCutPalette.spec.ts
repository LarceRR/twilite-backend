import { describe, expect, it } from 'vitest';

import { buildMedianCutPalette } from './buildMedianCutPalette';
import { mapToPalette } from './mapToPalette';

describe('median-cut + palette map', () => {
  it('строит палитру не больше запрошенного размера', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
    ]);
    const palette = buildMedianCutPalette(data, 4);
    expect(palette.length).toBeLessThanOrEqual(4);
    expect(palette.length).toBeGreaterThan(0);
  });

  it('игнорирует прозрачные пиксели в палитре', () => {
    const data = new Uint8ClampedArray([
      0,
      0,
      0,
      0, // transparent black — must not enter the palette
      255,
      0,
      0,
      255,
      255,
      0,
      0,
      255,
    ]);
    const palette = buildMedianCutPalette(data, 2);
    expect(palette.every(([r, g, b]) => r > 200 && g < 50 && b < 50)).toBe(true);
  });

  it('mapToPalette сохраняет прозрачность', () => {
    const data = new Uint8ClampedArray([10, 10, 10, 255, 0, 0, 0, 0]);
    const palette = [
      [0, 0, 0],
      [255, 255, 255],
    ] as const;
    mapToPalette(data, palette);
    expect([...data.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...data.slice(4, 8)]).toEqual([0, 0, 0, 0]);
  });
});
