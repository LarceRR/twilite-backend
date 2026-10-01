import sharp, { type Sharp } from 'sharp';

import type { PixelObjectManifest } from '@/shared/contracts/pixelObjects.contract';
import { PIXEL_OBJECT_CANVAS_MAX } from '@/shared/contracts/pixelObjects.contract';
import { type FieldViolation, ValidationError } from '@/shared/errors';

const SHEET_EDGE_MAX = PIXEL_OBJECT_CANVAS_MAX * 64;

export type PixelObjectSheetLimits = {
  readonly maxFrames: number;
  readonly maxBytes: number;
};

/** Manifest rules that zod shape alone cannot express (indices, grid, canvas match). */
export function collectManifestViolations(
  manifest: PixelObjectManifest,
  maxFrames: number,
): FieldViolation[] {
  const violations: FieldViolation[] = [];
  const { canvas, sheet, animations, staticPreviewFrame } = manifest;
  const animation = animations[0];

  if (sheet.frameWidth !== canvas.width || sheet.frameHeight !== canvas.height) {
    violations.push({
      path: 'manifest.sheet',
      message: 'Размер кадра должен совпадать с холстом',
    });
  }

  if (sheet.frameCount > maxFrames) {
    violations.push({
      path: 'manifest.sheet.frameCount',
      message: `Не больше ${maxFrames} кадров`,
    });
  }

  if (animation === undefined || animation.frames.length !== sheet.frameCount) {
    violations.push({
      path: 'manifest.animations',
      message: 'Число кадров анимации должно совпадать с frameCount',
    });
  }

  const cells = sheet.columns * sheet.rows;
  if (cells < sheet.frameCount || cells > maxFrames) {
    violations.push({
      path: 'manifest.sheet',
      message: 'Сетка spritesheet не вмещает кадры в лимит',
    });
  }

  if (staticPreviewFrame >= sheet.frameCount) {
    violations.push({
      path: 'manifest.staticPreviewFrame',
      message: 'Превью указывает на несуществующий кадр',
    });
  }

  if (animation !== undefined) {
    const seen = new Set<number>();
    for (const entry of animation.frames) {
      if (entry.frame < 0 || entry.frame >= sheet.frameCount || seen.has(entry.frame)) {
        violations.push({
          path: 'manifest.animations.0.frames',
          message: 'Кадры должны быть уникальными индексами 0..frameCount-1',
        });
        break;
      }
      seen.add(entry.frame);
    }
    if (
      seen.size !== sheet.frameCount &&
      !violations.some((item) => item.path === 'manifest.animations.0.frames')
    ) {
      violations.push({
        path: 'manifest.animations.0.frames',
        message: 'Анимация должна покрывать каждый кадр ровно один раз',
      });
    }
  }

  return violations;
}

/**
 * Decode the stored PNG and reject sheets whose pixels do not match the manifest.
 * Alpha > 0 counts as content, including soft-brush pixels.
 */
export async function assertPixelObjectSheet(
  png: Buffer,
  manifest: PixelObjectManifest,
  limits: PixelObjectSheetLimits,
): Promise<void> {
  const violations = collectManifestViolations(manifest, limits.maxFrames);
  if (png.byteLength === 0 || png.byteLength > limits.maxBytes) {
    violations.push({
      path: 'manifest.sheet',
      message: `Spritesheet должен быть PNG не больше ${limits.maxBytes} байт`,
    });
  }

  if (violations.length > 0) {
    throw new ValidationError('Пакет pixel object не прошёл проверку', violations);
  }

  const { sheet } = manifest;
  const expectedWidth = sheet.frameWidth * sheet.columns;
  const expectedHeight = sheet.frameHeight * sheet.rows;

  let image: Sharp;
  try {
    image = sharp(png, { limitInputPixels: SHEET_EDGE_MAX * SHEET_EDGE_MAX, animated: false });
    const meta = await image.metadata();
    if (meta.format !== 'png') {
      throw new ValidationError('Spritesheet должен быть PNG', [
        { path: 'manifest.sheet', message: 'Ожидается image/png' },
      ]);
    }
    if (
      meta.width !== expectedWidth ||
      meta.height !== expectedHeight ||
      meta.width > SHEET_EDGE_MAX ||
      meta.height > SHEET_EDGE_MAX
    ) {
      throw new ValidationError('Геометрия spritesheet не совпадает с manifest', [
        {
          path: 'manifest.sheet',
          message: `Ожидается ${expectedWidth}×${expectedHeight}`,
        },
      ]);
    }

    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4 || !frameRegionHasOpaquePixel(data, info.width, sheet)) {
      throw new ValidationError('В пакете нет видимых пикселей', [
        { path: 'manifest.sheet', message: 'Нужен хотя бы один непрозрачный пиксель' },
      ]);
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Не удалось прочитать spritesheet', [
      { path: 'manifest.sheet', message: 'Файл повреждён или не является PNG' },
    ]);
  }
}

function frameRegionHasOpaquePixel(
  data: Buffer,
  sheetWidth: number,
  sheet: PixelObjectManifest['sheet'],
): boolean {
  for (let frame = 0; frame < sheet.frameCount; frame += 1) {
    const col = frame % sheet.columns;
    const row = Math.floor(frame / sheet.columns);
    const x0 = col * sheet.frameWidth;
    const y0 = row * sheet.frameHeight;
    for (let y = 0; y < sheet.frameHeight; y += 1) {
      for (let x = 0; x < sheet.frameWidth; x += 1) {
        const alpha = data[((y0 + y) * sheetWidth + (x0 + x)) * 4 + 3];
        if (alpha !== undefined && alpha > 0) {
          return true;
        }
      }
    }
  }
  return false;
}
