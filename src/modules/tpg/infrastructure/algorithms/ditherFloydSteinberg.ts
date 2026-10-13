import { nearestPaletteEntry } from './mapToPalette';
import { toPaletteEntries } from './oklab';
import { isOpaqueEnough, type RawRgbaImage, type Rgb, sampleAt } from './rawRgba';

type DiffuseFn = (
  buffer: Float32Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number,
) => void;

/**
 * Floyd–Steinberg on opaque pixels only — error never bleeds into transparency.
 */
export function ditherFloydSteinberg(image: RawRgbaImage, palette: readonly Rgb[]): void {
  runErrorDiffusion(image, palette, diffuseFloyd);
}

/** Atkinson — cleaner / higher-contrast Mac-classic look. */
export function ditherAtkinson(image: RawRgbaImage, palette: readonly Rgb[]): void {
  runErrorDiffusion(image, palette, diffuseAtkinson);
}

function runErrorDiffusion(image: RawRgbaImage, palette: readonly Rgb[], diffuse: DiffuseFn): void {
  const { data, width, height } = image;
  const entries = toPaletteEntries(palette);
  const buffer = Float32Array.from(data);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (!isOpaqueEnough(sampleAt(data, i + 3))) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        continue;
      }

      const oldR = sampleAt(buffer, i);
      const oldG = sampleAt(buffer, i + 1);
      const oldB = sampleAt(buffer, i + 2);
      const { rgb } = nearestPaletteEntry(oldR, oldG, oldB, entries);

      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];

      diffuse(buffer, data, width, height, x, y, oldR - rgb[0], oldG - rgb[1], oldB - rgb[2]);
    }
  }
}

function diffuseFloyd(
  buffer: Float32Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number,
): void {
  addError(buffer, data, width, height, x + 1, y, errR, errG, errB, 7 / 16);
  addError(buffer, data, width, height, x - 1, y + 1, errR, errG, errB, 3 / 16);
  addError(buffer, data, width, height, x, y + 1, errR, errG, errB, 5 / 16);
  addError(buffer, data, width, height, x + 1, y + 1, errR, errG, errB, 1 / 16);
}

function diffuseAtkinson(
  buffer: Float32Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number,
): void {
  // Atkinson spreads 1/8 to six neighbours (and discards 2/8) → punchier contrast.
  const w = 1 / 8;
  addError(buffer, data, width, height, x + 1, y, errR, errG, errB, w);
  addError(buffer, data, width, height, x + 2, y, errR, errG, errB, w);
  addError(buffer, data, width, height, x - 1, y + 1, errR, errG, errB, w);
  addError(buffer, data, width, height, x, y + 1, errR, errG, errB, w);
  addError(buffer, data, width, height, x + 1, y + 1, errR, errG, errB, w);
  addError(buffer, data, width, height, x, y + 2, errR, errG, errB, w);
}

function addError(
  buffer: Float32Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number,
  weight: number,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 4;
  if (!isOpaqueEnough(sampleAt(data, i + 3))) return;
  buffer[i] = sampleAt(buffer, i) + errR * weight;
  buffer[i + 1] = sampleAt(buffer, i + 1) + errG * weight;
  buffer[i + 2] = sampleAt(buffer, i + 2) + errB * weight;
}
