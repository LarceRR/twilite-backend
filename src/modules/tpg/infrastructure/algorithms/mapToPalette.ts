import { oklabDistanceSq, rgbToOklab, toPaletteEntries, type PaletteEntry } from './oklab';
import { isOpaqueEnough, type Rgb } from './rawRgba';

/** Nearest palette colour by Oklab distance (looks closer to the eye than sRGB). */
export function nearestPaletteColor(r: number, g: number, b: number, palette: readonly Rgb[]): Rgb {
  const entries = toPaletteEntries(palette);
  return nearestPaletteEntry(r, g, b, entries).rgb;
}

export function nearestPaletteEntry(
  r: number,
  g: number,
  b: number,
  entries: readonly PaletteEntry[],
): PaletteEntry {
  const target = rgbToOklab(r, g, b);
  let best = entries[0]!;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const dist = oklabDistanceSq(target, entry.oklab);
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }

  return best;
}

/** Snap opaque pixels to the closest palette entry; leave alpha untouched. */
export function mapToPalette(data: Uint8ClampedArray, palette: readonly Rgb[]): void {
  const entries = toPaletteEntries(palette);

  for (let i = 0; i < data.length; i += 4) {
    if (!isOpaqueEnough(data[i + 3]!)) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      continue;
    }

    const { rgb } = nearestPaletteEntry(data[i]!, data[i + 1]!, data[i + 2]!, entries);
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
  }
}
