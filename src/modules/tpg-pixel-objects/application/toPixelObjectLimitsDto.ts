import { DEFAULT_PIXEL_OBJECT_LIMITS, type PixelObjectLimits } from '@twilite/contracts';

import type { AppLimits } from '@/config/limits';
import {
  PIXEL_OBJECT_MAX_FRAME_DURATION_MS,
  PIXEL_OBJECT_MIN_FRAME_DURATION_MS,
} from '@/shared/contracts/pixelObjects.contract';

/** Maps authoritative LIMIT_DEFINITIONS values into the public limits DTO. */
export function toPixelObjectLimitsDto(limits: AppLimits): PixelObjectLimits {
  return {
    canvasMax: DEFAULT_PIXEL_OBJECT_LIMITS.canvasMax,
    maxFrames: limits.tpg.pixelObjectMaxFrames,
    sheetMaxBytes: limits.tpg.pixelObjectSheetMaxBytes,
    minFrameDurationMs: PIXEL_OBJECT_MIN_FRAME_DURATION_MS,
    maxFrameDurationMs: PIXEL_OBJECT_MAX_FRAME_DURATION_MS,
    titleMax: DEFAULT_PIXEL_OBJECT_LIMITS.titleMax,
    surfaceMax: limits.moments.objectsPerSurface,
    supportedFormat: DEFAULT_PIXEL_OBJECT_LIMITS.supportedFormat,
  };
}
