import { isOpaqueEnough, type Rgb, sampleAt } from './rawRgba';

/** Heckbert median-cut over opaque pixels only — ignores transparent background. */
export function buildMedianCutPalette(data: Uint8ClampedArray, colorCount: number): Rgb[] {
  const pixels = collectOpaquePixels(data);
  if (pixels.length === 0) return [[0, 0, 0]];

  let buckets: Rgb[][] = [pixels];

  while (buckets.length < colorCount) {
    const index = findWidestBucket(buckets);
    if (index < 0) break;
    const bucket = buckets[index];
    if (bucket === undefined) break;
    const [left, right] = splitBucket(bucket);
    buckets = [...buckets.slice(0, index), left, right, ...buckets.slice(index + 1)];
  }

  return buckets.map(averageBucket);
}

function collectOpaquePixels(data: Uint8ClampedArray): Rgb[] {
  const pixels: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (!isOpaqueEnough(sampleAt(data, i + 3))) continue;
    pixels.push([sampleAt(data, i), sampleAt(data, i + 1), sampleAt(data, i + 2)]);
  }
  return pixels;
}

function findWidestBucket(buckets: Rgb[][]): number {
  let best = -1;
  let bestRange = -1;

  for (let i = 0; i < buckets.length; i += 1) {
    const bucket = buckets[i];
    if (bucket === undefined) continue;
    const range = channelRange(bucket).span;
    if (range > bestRange && bucket.length > 1) {
      bestRange = range;
      best = i;
    }
  }

  return best;
}

function channelRange(pixels: Rgb[]): { channel: 0 | 1 | 2; span: number } {
  let minR = 255,
    minG = 255,
    minB = 255,
    maxR = 0,
    maxG = 0,
    maxB = 0;

  for (const [r, g, b] of pixels) {
    minR = Math.min(minR, r);
    minG = Math.min(minG, g);
    minB = Math.min(minB, b);
    maxR = Math.max(maxR, r);
    maxG = Math.max(maxG, g);
    maxB = Math.max(maxB, b);
  }

  const ranges: Array<{ channel: 0 | 1 | 2; span: number }> = [
    { channel: 0, span: maxR - minR },
    { channel: 1, span: maxG - minG },
    { channel: 2, span: maxB - minB },
  ];

  return ranges.reduce((widest, next) => (next.span > widest.span ? next : widest));
}

function splitBucket(pixels: Rgb[]): [Rgb[], Rgb[]] {
  const { channel } = channelRange(pixels);
  const sorted = [...pixels].sort((a, b) => a[channel] - b[channel]);
  const mid = Math.floor(sorted.length / 2);
  return [sorted.slice(0, mid), sorted.slice(mid)];
}

function averageBucket(pixels: Rgb[]): Rgb {
  let r = 0,
    g = 0,
    b = 0;
  for (const pixel of pixels) {
    r += pixel[0];
    g += pixel[1];
    b += pixel[2];
  }
  const n = pixels.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
