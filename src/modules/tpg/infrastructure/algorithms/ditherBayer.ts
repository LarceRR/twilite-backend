import { nearestPaletteEntry } from './mapToPalette';
import { toPaletteEntries } from './oklab';
import { isOpaqueEnough, type RawRgbaImage, type Rgb } from './rawRgba';

/** 8×8 Bayer matrix (values 0–63). */
const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
] as const;

/**
 * Ordered dither on opaque pixels only — transparent background stays clear.
 */
export function ditherBayer(image: RawRgbaImage, palette: readonly Rgb[]): void {
  const { data, width, height } = image;
  const entries = toPaletteEntries(palette);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (!isOpaqueEnough(data[i + 3]!)) {
        clearRgb(data, i);
        continue;
      }

      const threshold = (BAYER_8[y & 7]![x & 7]! / 64 - 0.5) * 64;
      const { rgb } = nearestPaletteEntry(
        clampByte(data[i]! + threshold),
        clampByte(data[i + 1]! + threshold),
        clampByte(data[i + 2]! + threshold),
        entries,
      );
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
  }
}

function clearRgb(data: Uint8ClampedArray, i: number): void {
  data[i] = 0;
  data[i + 1] = 0;
  data[i + 2] = 0;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
