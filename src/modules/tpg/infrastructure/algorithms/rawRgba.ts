/** Packed RGB triplet 0–255. */
export type Rgb = readonly [number, number, number];

/** Near-transparent pixels are ignored by palette builders / dither. */
export const ALPHA_CUTOFF = 16;

export type RawRgbaImage = {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
};

export function createRawRgba(
  width: number,
  height: number,
  data?: Uint8ClampedArray,
): RawRgbaImage {
  return {
    width,
    height,
    data: data ?? new Uint8ClampedArray(width * height * 4),
  };
}

export function isOpaqueEnough(alpha: number): boolean {
  return alpha >= ALPHA_CUTOFF;
}
