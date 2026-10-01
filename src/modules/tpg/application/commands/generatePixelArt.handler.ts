import { Inject, Injectable } from '@nestjs/common';

import { LIMITS, type AppLimits } from '@/config/limits';
import type { PixelateResponseDto } from '@/shared/contracts/tpg.contract';
import { ValidationError } from '@/shared/errors';

import {
  normalizeAlgorithm,
  normalizePaletteSize,
} from '../../domain/algorithms/pixelArtAlgorithm';
import {
  PIXEL_ART_PROCESSOR,
  type PixelArtProcessor,
  type PixelArtResult,
} from '../../domain/ports/PixelArtProcessor';
import { assertImageBuffer } from '../../domain/services/assertImageBuffer';
import { normalizePixelSize } from '../../domain/services/normalizePixelSize';
import { fetchImageFromUrl } from '../../infrastructure/loaders/fetchImageFromUrl';

export type GeneratePixelArtInput = {
  readonly buffer?: Buffer;
  readonly imageUrl?: string;
  readonly pixelSize?: number;
  readonly algorithm?: string;
  readonly paletteSize?: number;
};

/**
 * Orchestrates source resolution → validation → pixelation.
 * Does not persist results — the response is the only artifact.
 */
@Injectable()
export class GeneratePixelArtHandler {
  constructor(
    @Inject(PIXEL_ART_PROCESSOR) private readonly processor: PixelArtProcessor,
    @Inject(LIMITS) private readonly limits: AppLimits,
  ) {}

  async execute(input: GeneratePixelArtInput): Promise<PixelateResponseDto> {
    const pixelSize = normalizePixelSize(input.pixelSize);
    const algorithm = normalizeAlgorithm(input.algorithm);
    const paletteSize = normalizePaletteSize(input.paletteSize);
    const source = await this.resolveSource(input);
    assertImageBuffer(source, this.limits.tpg.imageMaxBytes);

    const result = await this.processor.pixelate(source, {
      pixelSize,
      algorithm,
      paletteSize,
    });
    return toResponseDto(result);
  }

  private async resolveSource(input: GeneratePixelArtInput): Promise<Buffer> {
    if (input.buffer !== undefined && input.imageUrl !== undefined) {
      throw new ValidationError('Укажите либо файл, либо URL', [
        { path: 'image', message: 'Нельзя передавать оба источника сразу' },
      ]);
    }

    if (input.buffer !== undefined) {
      return input.buffer;
    }

    if (input.imageUrl !== undefined) {
      return fetchImageFromUrl(input.imageUrl, this.limits.tpg.imageMaxBytes);
    }

    throw new ValidationError('Источник изображения не указан', [
      { path: 'image', message: 'Нужен файл или imageUrl' },
    ]);
  }
}

function toResponseDto(result: PixelArtResult): PixelateResponseDto {
  return {
    mimeType: result.mimeType,
    width: result.width,
    height: result.height,
    imageBase64: result.buffer.toString('base64'),
    nativeWidth: result.nativeWidth,
    nativeHeight: result.nativeHeight,
    nativeBase64: result.nativeBuffer.toString('base64'),
    pixelSize: result.pixelSize,
    paletteSize: result.paletteSize,
    algorithm: result.algorithm,
  };
}
