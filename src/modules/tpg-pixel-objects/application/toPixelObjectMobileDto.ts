import type {
  PixelObjectManifest,
  PixelObjectMobileDto,
} from '@/shared/contracts/pixelObjects.contract';

export function toPixelObjectMobileDto(input: {
  readonly id: string;
  readonly title: string;
  readonly sheetUrl: string;
  readonly manifest: PixelObjectManifest;
}): PixelObjectMobileDto {
  const { manifest } = input;
  return {
    id: input.id,
    title: input.title,
    format: manifest.format,
    sheetUrl: input.sheetUrl,
    canvas: manifest.canvas,
    sheet: {
      frameWidth: manifest.sheet.frameWidth,
      frameHeight: manifest.sheet.frameHeight,
      columns: manifest.sheet.columns,
      rows: manifest.sheet.rows,
      frameCount: manifest.sheet.frameCount,
    },
    animations: manifest.animations,
    staticPreviewFrame: manifest.staticPreviewFrame,
  };
}
