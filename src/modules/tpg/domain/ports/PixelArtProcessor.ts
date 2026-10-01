import {
  DEFAULT_PIXEL_ART_ALGORITHM,
  type PixelArtAlgorithm,
} from '../algorithms/pixelArtAlgorithm';

export const PIXEL_ART_PROCESSOR = Symbol('PIXEL_ART_PROCESSOR');

export type PixelArtOptions = {
  readonly pixelSize: number;
  readonly algorithm?: PixelArtAlgorithm;
  readonly paletteSize?: number;
};

export type PixelArtResult = {
  readonly buffer: Buffer;
  /** True 1:1 pixel-art grid (no upscale). */
  readonly nativeBuffer: Buffer;
  readonly mimeType: 'image/png';
  readonly width: number;
  readonly height: number;
  readonly nativeWidth: number;
  readonly nativeHeight: number;
  readonly pixelSize: number;
  readonly algorithm: PixelArtAlgorithm;
  readonly paletteSize: number;
};

/**
 * Port: how pixels are produced is an infrastructure detail.
 * Domain and application only know this contract.
 */
export interface PixelArtProcessor {
  pixelate(source: Buffer, options: PixelArtOptions): Promise<PixelArtResult>;
}

export { DEFAULT_PIXEL_ART_ALGORITHM };
